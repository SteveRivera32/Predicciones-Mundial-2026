import {
  getParticipants,
  getParticipantById,
  canEditOfficialResults,
  setParticipantsList,
  isAdminParticipantId,
  ADMIN_PARTICIPANT_ID,
} from "./participants.js";
import {
  loadSession,
  saveSession,
  clearSession,
  isPinVerified,
  markPinVerified,
  clearPinVerifiedForParticipant,
} from "./session.js";
import {
  loadPredictions,
  savePredictions,
  deletePredictionsStorage,
  clearAllParticipantsPredictions,
} from "./predictions-store.js";
import { loadOfficialResults, saveOfficialResults, clearOfficialResultsStorage } from "./official-results-store.js";
import { isRemoteSyncActive } from "./remote-sync-flags.js";
import { applyRemoteState } from "./sync.js";
import { pushResetQuiniela } from "./sync-push.js";
import {
  computeGroupMatchPoints,
  computeGroupMatchPointsBreakdown,
  isExactGroupPrediction,
  predictionOutcomeSign,
} from "./group-match-points.js";
import {
  computeGeneralPredictionsScore,
  computeGroupOrderPoints,
  GROUP_PERFECT_ORDER_BONUS,
  GROUP_QUALIFIERS_ORDER_BONUS,
  INDIVIDUAL_AWARD_POINTS,
  MAX_PER_GROUP,
  MATCH_SCORING,
} from "./scoring-rules.js";
import { AWARD_NOMINEES } from "./award-nominees.js";
import {
  GROUPS,
  GROUP_MATCHES,
  KNOCKOUT_ROUNDS,
  getTeamFlagImgHtml,
  isPlaceholderTeam,
  winnerSideFromKnockoutScore,
  resolveKnockoutSlotLabel,
  getKnockoutMatchesFlat,
  BRACKET_SIDE_MATCH_INDICES,
  KNOCKOUT_PHASE_ROUND_INDEX,
} from "./tournament.js";
import { isLockedAtKickoff } from "./locks.js";

const TAB_KEY = "pm26-active-tab";
const BRACKET_FOCUS_KEY = "pm26-bracket-focus";
const PARTIDOS_SCOPE_KEY = "pm26-partidos-scope";
const MATCH_RANK_SCOPE_KEY = "pm26-match-rank-scope";
const MATCH_RANK_GROUP_KEY = "pm26-match-rank-group";
const TEAM_STATS_LEFT_SOURCE_KEY = "pm26-team-stats-left-source";
const TEAM_STATS_RIGHT_SOURCE_KEY = "pm26-team-stats-right-source";
const TEAM_STATS_VIEW_KEY = "pm26-team-stats-view";
const TEAM_ORDER_LEFT_SOURCE_KEY = "pm26-team-order-left-source";
const TEAM_ORDER_RIGHT_SOURCE_KEY = "pm26-team-order-right-source";
const FASE_GRUPOS_FILTER_KEY = "pm26-fase-grupos-gid";
const FLOATING_RANK_POS_KEY = "pm26-floating-rank-pos";
const FLOATING_RANK_ENABLED_KEY = "pm26-floating-rank-enabled";
const MAX_BEST_THIRD_TEAMS = 8;
let tabsController = null;
let floatingRankingReady = false;

/** Nombres de equipo conocidos en fase de grupos (para banderas en la llave). */
const BRACKET_KNOWN_TEAMS = new Set(GROUPS.flatMap((g) => g.teams));

/** Evita listeners duplicados al refrescar el formulario de generales (mismo elemento form del DOM). */
let generalesUserAwardChangeHandler = null;

/**
 * Reglas por partido en quiniela: por defecto fase de grupos.
 * Un partido puede llevar `matchScoringKey` alineado con `MATCH_SCORING` (p. ej. `"r32"`, `"r16"`).
 * @param {{ matchScoringKey?: string }} m
 */
function getMatchScoringForQuiniela(m) {
  const key = m.matchScoringKey;
  if (key && Object.prototype.hasOwnProperty.call(MATCH_SCORING, key)) {
    return MATCH_SCORING[/** @type {keyof typeof MATCH_SCORING} */ (key)];
  }
  return MATCH_SCORING.group;
}

/** Votos confirmados de resultado (local / empate / visitante) en un partido de grupos. */
function collectOutcomeVotesForMatch(matchId) {
  const votes = [];
  for (const part of getParticipants()) {
    const store = loadPredictions(part.id);
    if (store.groupScoresConfirmed?.[matchId] !== true) continue;
    const pred = store.groupScores[matchId] ?? {};
    const s = predictionOutcomeSign(pred);
    if (s) votes.push(s);
  }
  return votes;
}

/**
 * Equipo minoritario por posición (1.º..4.º) para un grupo.
 * Se cuentan picks de todos los participantes, estén confirmados o no.
 * @param {string} groupId
 * @returns {Map<string, number>[]}
 */
function getGroupOrderVoteCountsByPosition(groupId) {
  /** @type {Map<string, number>[]} */
  const countsByPos = [new Map(), new Map(), new Map(), new Map()];
  for (const part of getParticipants()) {
    const store = loadPredictions(part.id);
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

/**
 * Bono por "único en esa posición": el equipo fue elegido por una sola persona
 * en esa posición, y hay al menos 2 votos totales en la columna.
 * @param {Map<string, number>} counts
 * @param {string} team
 */
function hasUniquePickBonus(counts, team) {
  if (!team) return false;
  const teamVotes = counts.get(team) ?? 0;
  if (teamVotes !== 1) return false;
  const totalVotes = [...counts.values()].reduce((acc, n) => acc + n, 0);
  return totalVotes >= 2;
}

function collectKnockoutOutcomeVotesForMatch(matchId) {
  const votes = [];
  for (const part of getParticipants()) {
    const store = loadPredictions(part.id);
    if (store.knockoutScoresConfirmed?.[matchId] !== true) continue;
    const pred = store.knockoutScores?.[matchId] ?? {};
    const s = predictionOutcomeSign(pred);
    if (s) votes.push(s);
  }
  return votes;
}

/**
 * Bono improbable por "pick unico" del resultado oficial.
 * Si el signo oficial tiene exactamente 1 voto confirmado (y hay al menos 2 votos),
 * se aplica el bono para ese signo.
 * @param {("h"|"d"|"a")[]} votes
 * @param {{ home: unknown, away: unknown }} officialScore
 * @returns {"h"|"d"|"a"|null}
 */
function getUniqueOfficialOutcomeBonusSign(votes, officialScore) {
  const officialSign = predictionOutcomeSign(officialScore);
  if (!officialSign) return null;
  /** @type {{ h: number, d: number, a: number }} */
  const c = { h: 0, d: 0, a: 0 };
  for (const s of votes) {
    if (s === "h" || s === "d" || s === "a") c[s] += 1;
  }
  const totalVotes = c.h + c.d + c.a;
  if (totalVotes < 2) return null;
  const distinctSigns = (c.h > 0 ? 1 : 0) + (c.d > 0 ? 1 : 0) + (c.a > 0 ? 1 : 0);
  if (distinctSigns < 2) return null;
  return c[officialSign] === 1 ? officialSign : null;
}

function getImprobableOutcomeSignForMatch(matchId, officialScore) {
  return getUniqueOfficialOutcomeBonusSign(collectOutcomeVotesForMatch(matchId), officialScore);
}

function getImprobableOutcomeSignForKoMatch(matchId, officialScore) {
  return getUniqueOfficialOutcomeBonusSign(collectKnockoutOutcomeVotesForMatch(matchId), officialScore);
}

function $(sel, root = document) {
  return root.querySelector(sel);
}

function ensureFaseGruposFilter() {
  const sel = $("#fase-grupos-filter");
  if (!sel) return;
  if (sel.dataset.ready !== "1") {
    sel.innerHTML =
      `<option value="">— Elige grupo —</option>` +
      GROUPS.map((g) => `<option value="${g.id}">Grupo ${g.id}</option>`).join("");
    sel.addEventListener("change", () => {
      localStorage.setItem(FASE_GRUPOS_FILTER_KEY, sel.value);
      refreshAll(loadSession());
    });
    sel.dataset.ready = "1";
  }
  const saved = localStorage.getItem(FASE_GRUPOS_FILTER_KEY);
  if (saved != null && [...sel.options].some((o) => o.value === saved)) {
    sel.value = saved;
  }
}

/**
 * @param {Record<string, { home: string|number|"", away: string|number|"" }>} groupScores
 */
function computeGroupStandingsByGroup(groupScores) {
  /** @type {Record<string, Array<{ team: string, groupId: string, played: number, wins: number, draws: number, losses: number, gf: number, ga: number, gd: number, pts: number }>>} */
  const byGroup = {};

  for (const grp of GROUPS) {
    const stats = new Map(
      grp.teams.map((t) => [
        t,
        {
          team: t,
          groupId: grp.id,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          gf: 0,
          ga: 0,
        },
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

function getLiveOfficialGroupSnapshot() {
  const confirmedScores = getOfficialConfirmedGroupScores();
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

  const thirdCandidates = GROUPS.map((grp) => {
    const list = standingsByGroup[grp.id] ?? [];
    if (!list[2]) return null;
    if (groupCompletedByGroup[grp.id] !== true) return null;
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

  const rankedThirdTeams = thirdCandidates.slice(0, MAX_BEST_THIRD_TEAMS).map((x) => x.team);
  return { orderByGroup, thirdAdvanceByGroup, hasOfficialDataByGroup, rankedThirdTeams, groupCompletedByGroup };
}

/**
 * Resuelve una banda semilla de 16vos contra el estado oficial en vivo.
 * @param {string} label
 * @param {Record<string, string[]>} orderByGroup
 * @param {Record<string, boolean>} groupCompletedByGroup
 * @param {string[]} rankedThirdTeams
 * @param {{ value: number }} thirdCursor
 */
function resolveLiveR32SeedLabel(
  label,
  orderByGroup,
  groupCompletedByGroup,
  rankedThirdTeams,
  thirdCursor,
) {
  const txt = String(label ?? "").trim();
  const m = /^([12])º Grupo ([A-L])$/.exec(txt);
  if (m) {
    const pos = m[1] === "1" ? 0 : 1;
    const groupId = m[2];
    if (groupCompletedByGroup[groupId] !== true) return txt;
    return orderByGroup[groupId]?.[pos] ?? txt;
  }
  if (txt === "3º ranking") {
    const idx = thirdCursor.value;
    thirdCursor.value += 1;
    return rankedThirdTeams[idx] ?? txt;
  }
  return txt;
}

/**
 * Mapa por banda de 16vos: `matchId:home|away` -> equipo resuelto.
 * @returns {Record<string, string>}
 */
function buildLiveR32SlotMap() {
  const snap = getLiveOfficialGroupSnapshot();
  const orderByGroup = snap.orderByGroup ?? {};
  const groupCompletedByGroup = snap.groupCompletedByGroup ?? {};
  const rankedThirdTeams = snap.rankedThirdTeams ?? [];
  const thirdCursor = { value: 0 };
  /** @type {Record<string, string>} */
  const out = {};
  const r32 = KNOCKOUT_ROUNDS[KNOCKOUT_PHASE_ROUND_INDEX.r32];
  for (const m of r32.matches) {
    out[`${m.id}:home`] = resolveLiveR32SeedLabel(
      m.homeLabel,
      orderByGroup,
      groupCompletedByGroup,
      rankedThirdTeams,
      thirdCursor,
    );
    out[`${m.id}:away`] = resolveLiveR32SeedLabel(
      m.awayLabel,
      orderByGroup,
      groupCompletedByGroup,
      rankedThirdTeams,
      thirdCursor,
    );
  }
  return out;
}

/**
 * @param {{ id: string, teams: string[] }} grp
 * @param {string | undefined} currentParticipantId
 */
function buildGroupPredictionsTableHtml(grp, currentParticipantId) {
  const liveOfficial = getLiveOfficialGroupSnapshot();
  const officialOrder = liveOfficial.orderByGroup[grp.id] ?? [];
  const hasOfficialData = liveOfficial.hasOfficialDataByGroup[grp.id] === true;
  const voteCountsByPos = getGroupOrderVoteCountsByPosition(grp.id);
  const officialThird = liveOfficial.thirdAdvanceByGroup[grp.id];
  const officialThirdDefined = officialThird === true || officialThird === false;

  let officialRowHtml;
  if (hasOfficialData) {
    const oCells = [0, 1, 2, 3]
      .map((i) => {
        const t = officialOrder[i];
        return `<td class="group-preds-pos">${t ? teamLabelHtml(t) : '<span class="muted">—</span>'}</td>`;
      })
      .join("");
    const oThird =
      officialThird === true ? "✓" : officialThird === false ? "✕" : '<span class="muted">—</span>';
    officialRowHtml = `<tr class="group-preds-row group-preds-row--official">
      <th scope="row" class="group-preds-name-col">Orden oficial</th>
      ${oCells}
      <td class="group-preds-third">
        <div class="group-preds-cell-wrap group-preds-cell-wrap--center">
          ${oThird}
        </div>
      </td>
      <td class="group-preds-pts"><div class="group-preds-pts-cell"><span class="muted">—</span></div></td>
    </tr>`;
  } else {
    const pendingCells = [0, 1, 2, 3]
      .map(() => `<td class="group-preds-pos"><span class="muted">—</span></td>`)
      .join("");
    officialRowHtml = `<tr class="group-preds-row group-preds-row--official group-preds-row--official-pending">
      <th scope="row" class="group-preds-name-col">Orden oficial <span class="td-muted">(pendiente)</span></th>
      ${pendingCells}
      <td class="group-preds-third">
        <div class="group-preds-cell-wrap group-preds-cell-wrap--center"><span class="muted">—</span></div>
      </td>
      <td class="group-preds-pts"><div class="group-preds-pts-cell"><span class="muted">—</span></div></td>
    </tr>`;
  }

  const groupParticipantRowData = [...getParticipants()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const pred = loadPredictions(p.id);
      const ord = pred.groupOrder?.[grp.id];
      const orderArr =
        Array.isArray(ord) && ord.length === 4
          ? ord.map((x) => (typeof x === "string" ? x : ""))
          : ["", "", "", ""];
      const thirdP = pred.groupThirdAdvances?.[grp.id];
      const thirdTxt = thirdP === true ? "✓" : thirdP === false ? "✕" : "—";
      const officialQualifiers = new Set([officialOrder[0], officialOrder[1]].filter(Boolean));
      const top2InExactOrder =
        hasOfficialData &&
        Boolean(orderArr[0]) &&
        Boolean(orderArr[1]) &&
        orderArr[0] === officialOrder[0] &&
        orderArr[1] === officialOrder[1];
      const fullOrderHit =
        hasOfficialData &&
        [0, 1, 2, 3].every(
          (i) =>
            Boolean(orderArr[i]) &&
            Boolean(officialOrder[i]) &&
            orderArr[i] === officialOrder[i],
        );
      const thirdHit =
        hasOfficialData &&
        officialThirdDefined &&
        (thirdP === true || thirdP === false) &&
        thirdP === officialThird;

      const posCells = [0, 1, 2, 3]
        .map((i) => {
          const t = orderArr[i];
          const hitExact =
            hasOfficialData &&
            Boolean(t) &&
            Boolean(officialOrder[i]) &&
            t === officialOrder[i];
          const hitQualifiedWrongPos =
            hasOfficialData &&
            !hitExact &&
            i < 2 &&
            Boolean(t) &&
            officialQualifiers.has(t);
          const cls = hitExact
            ? "group-preds-pos group-preds-pos--hit"
            : hitQualifiedWrongPos
              ? "group-preds-pos group-preds-pos--qual-hit"
              : "group-preds-pos";

          let ptsCell = 0;
          let bonusPtsCell = 0;
          let badgeTitle = "";
          if (hasOfficialData && i < 2 && Boolean(t) && officialQualifiers.has(t)) {
            ptsCell += 1;
            badgeTitle = "Clasificado directo acertado (+1)";
          }
          if (hasOfficialData && hitExact && hasUniquePickBonus(voteCountsByPos[i], t)) {
            bonusPtsCell += 1;
          }
          const cellPoints = ptsCell + bonusPtsCell;
          const badge = pointsBadgeHtml(cellPoints, {
            bonus: bonusPtsCell > 0,
            title:
              bonusPtsCell > 0
                ? ptsCell > 0
                  ? "Acierto en posición con bono por minoría (+1 base +1 bono)"
                  : "Acierto en posición con bono por minoría (+1 bono)"
                : badgeTitle,
          });

          return `<td class="${cls}">
            <div class="group-preds-cell-wrap">
              ${t ? teamLabelHtml(t) : '<span class="muted">—</span>'}
              ${badge}
            </div>
          </td>`;
        })
        .join("");

      let thirdCellClass = "group-preds-third";
      if (thirdHit) {
        thirdCellClass += " group-preds-third--hit";
      }

      const groupOrderPts = hasOfficialData
        ? computeGroupOrderPoints(
            orderArr,
            officialOrder,
            thirdP,
            officialThirdDefined ? officialThird : undefined,
          )
        : 0;
      const minorityBonusPts = hasOfficialData
        ? [0, 1, 2, 3].reduce((acc, i) => {
            const t = orderArr[i];
            const isExact =
              Boolean(t) && Boolean(officialOrder[i]) && t === officialOrder[i];
            if (isExact && hasUniquePickBonus(voteCountsByPos[i], t)) return acc + 1;
            return acc;
          }, 0)
        : 0;
      /** Solo puntos del bloque «orden del grupo» (máx. 6); la quiniela por partido se ve en su pestaña. */
      const groupPts = groupOrderPts + minorityBonusPts;

      return {
        p,
        posCells,
        thirdCellClass,
        thirdTxt,
        thirdHit,
        top2InExactOrder,
        fullOrderHit,
        groupPts,
      };
    });

  const maxGroupPts = Math.max(0, ...groupParticipantRowData.map((r) => r.groupPts));

  const participantRows = groupParticipantRowData
    .map((row) => {
      const { p, posCells, thirdCellClass, thirdTxt, thirdHit, top2InExactOrder, fullOrderHit, groupPts } = row;
      const rowClasses = ["group-preds-row", p.id === currentParticipantId ? "row-self" : ""].filter(Boolean).join(" ");
      const you = p.id === currentParticipantId ? ' <span class="td-muted">(tú)</span>' : "";
      const perfectOrderPts = GROUP_QUALIFIERS_ORDER_BONUS + GROUP_PERFECT_ORDER_BONUS;
      let orderBonusUnderName = "";
      if (hasOfficialData && fullOrderHit) {
        orderBonusUnderName = `<div class="quiniela-perfect-inline group-preds-order-bonus-inline" role="status" aria-label="Orden 1.º a 4.º exacto"><span class="group-preds-perfecto-label">Perfecto</span>${pointsBadgeHtml(perfectOrderPts, {
          title: `+${GROUP_QUALIFIERS_ORDER_BONUS} por orden de 1.º y 2.º y +${GROUP_PERFECT_ORDER_BONUS} por el grupo completo`,
        })}</div>`;
      } else if (hasOfficialData && top2InExactOrder) {
        orderBonusUnderName = `<div class="quiniela-perfect-inline group-preds-order-bonus-inline" role="status" aria-label="Orden de 1.º y 2.º correcto"><span class="group-preds-bien-label">Bien</span>${pointsBadgeHtml(GROUP_QUALIFIERS_ORDER_BONUS, {
          title: `+${GROUP_QUALIFIERS_ORDER_BONUS} por orden correcto de 1.º y 2.º`,
        })}</div>`;
      }
      const ptsTdClass =
        maxGroupPts > 0 && groupPts === maxGroupPts
          ? "group-preds-pts group-preds-pts--top"
          : "group-preds-pts";
      return `<tr class="${rowClasses}">
        <th scope="row" class="group-preds-name-col">
          <div class="quiniela-participant-cell">
            <div class="quiniela-participant-line">${escapeHtml(p.name)}${you}</div>
            ${orderBonusUnderName}
          </div>
        </th>
        ${posCells}
        <td class="${thirdCellClass}">
          <div class="group-preds-cell-wrap group-preds-cell-wrap--center">
            ${thirdTxt}
            ${pointsBadgeHtml(thirdHit ? 1 : 0, { title: "Acierto: 3.º pasa / no pasa" })}
          </div>
        </td>
        <td class="${ptsTdClass}"><div class="group-preds-pts-cell">${groupPts}</div></td>
      </tr>`;
    })
    .join("");

  return `
    <h2 class="subsection-title group-preds-table-title">Predicciones de todos · orden y puntos en vivo del grupo</h2>
    <p class="muted group-preds-legend"><span class="group-preds-legend-swatch group-preds-legend-swatch--cell"></span> Posición correcta
      · <span class="group-preds-legend-swatch group-preds-legend-swatch--qual"></span> Clasifica, pero en otra posición
      · <strong class="group-preds-bien-intro">Bien</strong> y <strong class="quiniela-perfect-intro-gold">Perfecto</strong> indican aciertos de orden
      · <span class="group-preds-legend-swatch group-preds-legend-swatch--pts-lead"></span> <strong>Pts</strong> dorado = líder del grupo</p>
    <div class="table-scroll table-scroll--group-preds">
      <table class="table table-compact table-group-preds" aria-label="Orden predicho en el grupo ${escapeHtml(grp.id)}">
        <thead>
          <tr>
            <th scope="col">Participante</th>
            <th scope="col">1.º</th>
            <th scope="col">2.º</th>
            <th scope="col">3.º</th>
            <th scope="col">4.º</th>
            <th scope="col" class="group-preds-th-third">3.º pasa</th>
            <th scope="col" class="group-preds-pts">Pts</th>
          </tr>
        </thead>
        <tbody>${officialRowHtml}${participantRows}</tbody>
      </table>
    </div>`;
}

function clampGoalInput(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return "";
  return Math.max(0, Math.min(20, n));
}

/**
 * @param {string} matchId
 * @param {"home"|"away"} side
 * @param {string|number|""} value
 * @param {{ disabled?: boolean, extraClass?: string, idAttr?: "data-mid"|"data-kid"|"data-okid" }} [opts]
 */
function scoreStepperHtml(matchId, side, value, opts = {}) {
  const { disabled = false, extraClass = "", idAttr = "data-mid" } = opts;
  const v = value === "" || value === undefined ? "" : String(clampGoalInput(value));
  const dis = disabled ? "disabled" : "";
  const idKey =
    idAttr === "data-kid" ? "data-kid" : idAttr === "data-okid" ? "data-okid" : "data-mid";
  return `<div class="score-stepper ${extraClass}">
    <button type="button" class="score-stepper__btn" ${idKey}="${escapeHtml(matchId)}" data-side="${side}" data-delta="-1" ${dis} aria-label="Un gol menos">−</button>
    <input type="number" min="0" max="20" class="score-stepper__input input input-score" ${idKey}="${escapeHtml(matchId)}" data-side="${side}" value="${escapeHtml(v)}" ${dis} step="1" />
    <button type="button" class="score-stepper__btn" ${idKey}="${escapeHtml(matchId)}" data-side="${side}" data-delta="1" ${dis} aria-label="Un gol más">+</button>
  </div>`;
}

/**
 * @param {HTMLElement} wrap
 * @param {"knockout"|"grupos"} mode
 * @param {(scores: Record<string, { home: string|number|"", away: string|number|"" }>) => void} onCommit
 */
function wireScoreSteppers(wrap, mode, onCommit) {
  const isKo = mode === "knockout";
  const inputSel = isKo ? ".score-stepper__input[data-kid]" : ".score-stepper__input[data-mid]";

  function collect() {
    /** @type {Record<string, { home: string|number|"", away: string|number|"" }>} */
    const next = {};
    wrap.querySelectorAll(inputSel).forEach((el) => {
      const id = isKo ? el.dataset.kid : el.dataset.mid;
      const side = el.dataset.side;
      if (!id || (side !== "home" && side !== "away")) return;
      if (!next[id]) next[id] = { home: "", away: "" };
      const raw =
        el.value === "" ? "" : Math.max(0, Math.min(20, parseInt(el.value, 10) || 0));
      next[id][side] = raw;
    });
    onCommit(next);
  }

  wrap.querySelectorAll(".score-stepper").forEach((stepper) => {
    const inp = stepper.querySelector(inputSel);
    if (!inp || inp.disabled) return;
    stepper.querySelectorAll(".score-stepper__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const d = parseInt(btn.dataset.delta ?? "0", 10);
        let n = inp.value === "" ? 0 : parseInt(inp.value, 10) || 0;
        n = Math.max(0, Math.min(20, n + d));
        inp.value = String(n);
        collect();
      });
    });
    inp.addEventListener("change", () => {
      const n = clampGoalInput(inp.value);
      inp.value = n === "" ? "" : String(n);
      collect();
    });
  });
}

/**
 * @param {HTMLElement} wrap
 * @param {(scores: Record<string, { home: string|number|"", away: string|number|"" }>) => void} onCommit
 */
function wireOfficialKnockoutSteppers(wrap, onCommit) {
  const inputSel = ".score-stepper__input[data-okid]";
  function collect() {
    /** @type {Record<string, { home: string|number|"", away: string|number|"" }>} */
    const next = {};
    wrap.querySelectorAll(inputSel).forEach((el) => {
      const id = el.dataset.okid;
      const side = el.dataset.side;
      if (!id || (side !== "home" && side !== "away")) return;
      if (!next[id]) next[id] = { home: "", away: "" };
      const raw =
        el.value === "" ? "" : Math.max(0, Math.min(20, parseInt(el.value, 10) || 0));
      next[id][side] = raw;
    });
    onCommit(next);
  }
  wrap.querySelectorAll(".score-stepper").forEach((stepper) => {
    const inp = stepper.querySelector(inputSel);
    if (!inp || inp.disabled) return;
    stepper.querySelectorAll(".score-stepper__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const d = parseInt(btn.dataset.delta ?? "0", 10);
        let n = inp.value === "" ? 0 : parseInt(inp.value, 10) || 0;
        n = Math.max(0, Math.min(20, n + d));
        inp.value = String(n);
        collect();
      });
    });
    inp.addEventListener("change", () => {
      const n = clampGoalInput(inp.value);
      inp.value = n === "" ? "" : String(n);
      collect();
    });
  });
}

/**
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @returns {Record<string, { home: number|string|"", away: number|string|"" }>}
 */
function officialKnockoutScoresMapForResolution(official) {
  /** @type {Record<string, { home: number|string|"", away: number|string|"" }>} */
  const out = {};
  const scores = official.knockoutScores ?? {};
  const conf = official.knockoutScoresConfirmed ?? {};
  for (const round of KNOCKOUT_ROUNDS) {
    for (const m of round.matches) {
      if (conf[m.id] !== true) continue;
      const s = scores[m.id];
      if (s && s.home !== "" && s.away !== "") out[m.id] = s;
    }
  }
  return out;
}

/** Marcadores KO rellenados (aunque no confirmados) para etiquetas en Partidos. */
function allFilledOfficialKnockoutScores(official) {
  /** @type {Record<string, { home: number|string|"", away: number|string|"" }>} */
  const out = {};
  const scores = official.knockoutScores ?? {};
  for (const round of KNOCKOUT_ROUNDS) {
    for (const m of round.matches) {
      const s = scores[m.id];
      if (s && s.home !== "" && s.away !== "") out[m.id] = s;
    }
  }
  return out;
}

function getKoRoundMatchIndex(matchId) {
  for (let ri = 0; ri < KNOCKOUT_ROUNDS.length; ri++) {
    const mi = KNOCKOUT_ROUNDS[ri].matches.findIndex((x) => x.id === matchId);
    if (mi >= 0) return { ri, mi };
  }
  return { ri: 0, mi: 0 };
}

/**
 * @param {string} label
 * @param {{ winner?: boolean }} opts
 */
function bracketTeamLineHtml(label, opts = {}) {
  const { winner = false } = opts;
  const winCls = winner ? " is-winner" : "";
  if (BRACKET_KNOWN_TEAMS.has(label)) {
    return `<div class="bracket-team-line${winCls}">${teamLabelHtml(label)}</div>`;
  }
  return `<div class="bracket-team-line bracket-team-line--seed${winCls}"><span class="bracket-slot-txt">${escapeHtml(label || "—")}</span></div>`;
}

/**
 * @param {(tabId: string) => void} [onTabChange]
 */
function initTabs(onTabChange) {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");

  function setTab(id) {
    tabs.forEach((t) => {
      const active = t.dataset.tab === id;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((p) => {
      const active = p.dataset.panel === id;
      p.classList.toggle("is-active", active);
      p.hidden = !active;
    });
    localStorage.setItem(TAB_KEY, id);
    onTabChange?.(id);
  }

  tabs.forEach((t) => {
    t.addEventListener("click", () => setTab(t.dataset.tab));
  });

  const saved = localStorage.getItem(TAB_KEY);
  let initial = saved && $(`.tab[data-tab="${saved}"]`) ? saved : "grupos";
  if (initial === "quiniela") initial = "partidos";
  setTab(initial);
  return { setTab };
}

function fillParticipantSelect(select) {
  select.innerHTML = "";
  for (const p of getParticipants()) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  }
}

function showOnboarding(onComplete) {
  const overlay = $("#overlay-onboarding");
  const select = $("#onboarding-participant");
  const pinWrap = $("#onboarding-pin-wrap");
  const pinInput = $("#onboarding-pin");
  const err = $("#onboarding-error");
  const submit = $("#onboarding-submit");

  fillParticipantSelect(select);

  function updatePinVisibility() {
    const p = getParticipantById(select.value);
    const needs =
      p?.pin != null &&
      p.pin !== "" &&
      !isPinVerified(p.id, p.pin);
    pinWrap.hidden = !needs;
    if (!needs) pinInput.value = "";
  }

  select.addEventListener("change", updatePinVisibility);

  function close() {
    overlay.hidden = true;
  }

  submit.addEventListener("click", () => {
    err.hidden = true;
    const p = getParticipantById(select.value);
    if (!p) {
      err.textContent = "Selecciona un participante.";
      err.hidden = false;
      return;
    }
    if (p.pin != null && p.pin !== "") {
      if (!isPinVerified(p.id, p.pin)) {
        if (pinInput.value !== p.pin) {
          err.textContent = "PIN incorrecto.";
          err.hidden = false;
          return;
        }
        markPinVerified(p.id, p.pin);
      }
    }
    saveSession({ participantId: p.id });
    close();
    onComplete();
  });

  overlay.hidden = false;
  updatePinVisibility();
  select.focus();
}

function updateSessionBar(session) {
  const chip = $("#session-chip");
  const nameEl = $("#session-name");
  const btn = $("#btn-cambiar-sesion");
  const settingsBtn = $("#btn-admin-settings");
  const p = session ? getParticipantById(session.participantId) : null;
  if (p) {
    chip.hidden = false;
    btn.hidden = false;
    nameEl.textContent = p.name;
    if (settingsBtn) {
      const isAdmin = canEditOfficialResults(session.participantId);
      settingsBtn.hidden = !isAdmin;
      settingsBtn.style.display = isAdmin ? "" : "none";
      settingsBtn.disabled = !isAdmin;
    }
  } else {
    chip.hidden = true;
    btn.hidden = true;
    nameEl.textContent = "";
    if (settingsBtn) {
      settingsBtn.hidden = true;
      settingsBtn.style.display = "none";
      settingsBtn.disabled = true;
    }
  }
}

const PARTICIPANT_ID_PATTERN = /^[a-z0-9_-]+$/i;

function renderAdminSettingsList() {
  const wrap = $("#admin-settings-list-wrap");
  if (!wrap) return;
  const list = getParticipants().sort((a, b) => a.name.localeCompare(b.name));
  wrap.innerHTML = `<ul class="admin-settings-list" aria-label="Participantes">
    ${list
      .map((p) => {
        const prot = isAdminParticipantId(p.id);
        const pinNote = p.pin ? " · con PIN" : "";
        return `<li class="admin-settings-row">
          <span class="admin-settings-row-meta">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="muted">${escapeHtml(p.id)}${escapeHtml(pinNote)}</span>
          </span>
          ${
            prot
              ? '<span class="muted admin-settings-protected">Administrador</span>'
              : `<button type="button" class="btn btn-sm" data-remove-id="${escapeHtml(p.id)}">Eliminar</button>`
          }
        </li>`;
      })
      .join("")}
  </ul>`;
  wrap.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-id");
      if (!id || isAdminParticipantId(id)) return;
      const person = getParticipantById(id);
      if (!person) return;
      if (
        !confirm(
          `¿Eliminar a ${person.name} (${id})? Se borrarán sus predicciones guardadas en este navegador.`,
        )
      ) {
        return;
      }
      const next = getParticipants().filter((x) => x.id !== id);
      setParticipantsList(next);
      deletePredictionsStorage(id);
      clearPinVerifiedForParticipant(id);
      const sess = loadSession();
      if (sess?.participantId === id) {
        clearSession();
        closeAdminSettingsOverlay();
        showOnboarding(adminSettingsAfterSessionFn);
        return;
      }
      renderAdminSettingsList();
      refreshAll(loadSession());
    });
  });
}

function openAdminSettingsOverlay() {
  const session = loadSession();
  if (!session || !canEditOfficialResults(session.participantId)) return;
  const overlay = $("#overlay-admin-settings");
  const hint = $("#admin-settings-admin-hint");
  if (!overlay) return;
  if (hint) {
    const admin = getParticipantById(ADMIN_PARTICIPANT_ID);
    hint.textContent = admin
      ? `El administrador (${admin.name}, id «${ADMIN_PARTICIPANT_ID}») no se puede eliminar.`
      : "";
  }
  renderAdminSettingsList();
  overlay.hidden = false;
}

function closeAdminSettingsOverlay() {
  const o = $("#overlay-admin-settings");
  if (o) o.hidden = true;
}

/** @type {() => void} */
let adminSettingsAfterSessionFn = () => {};

function bindAdminSettings(afterSessionReady) {
  adminSettingsAfterSessionFn = afterSessionReady;
  const openBtn = $("#btn-admin-settings");
  const overlay = $("#overlay-admin-settings");
  const closeBtn = $("#admin-settings-close");
  const form = $("#form-admin-add-participant");
  const resetAllBtn = $("#btn-admin-reset-all-predictions");
  if (!openBtn || !overlay || !form) return;

  openBtn.addEventListener("click", () => {
    const session = loadSession();
    if (!session || !canEditOfficialResults(session.participantId)) return;
    openAdminSettingsOverlay();
  });
  closeBtn?.addEventListener("click", () => closeAdminSettingsOverlay());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAdminSettingsOverlay();
  });

  resetAllBtn?.addEventListener("click", async () => {
    const session = loadSession();
    if (!session || !canEditOfficialResults(session.participantId)) return;
    if (
      !confirm(
        isRemoteSyncActive()
          ? "¿Borrar en el servidor las predicciones de todos y todo el resultado oficial (admin)? Todos los conectados verán el reinicio. No se puede deshacer."
          : "¿Borrar en este navegador las predicciones de todos y todo el resultado oficial (admin)? No se puede deshacer.",
      )
    ) {
      return;
    }
    if (
      !confirm(
        "Última confirmación: quiniela, grupos, predicciones generales, marcadores y podio oficial quedarán vacíos o pendientes. ¿Continuar?",
      )
    ) {
      return;
    }
    if (isRemoteSyncActive()) {
      try {
        const res = await pushResetQuiniela();
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (body.data) applyRemoteState(body.data);
      } catch {
        alert("No se pudo reiniciar en el servidor. Comprueba que el proceso del API siga en marcha.");
        return;
      }
    } else {
      clearAllParticipantsPredictions();
      clearOfficialResultsStorage();
    }
    closeAdminSettingsOverlay();
    refreshAll(loadSession());
    alert(
      isRemoteSyncActive()
        ? "Listo: predicciones y resultados oficiales reiniciados para todos. La lista de participantes en Ajustes no cambia."
        : "Listo: predicciones de todos y resultados oficiales reiniciados en este navegador. La lista de participantes en Ajustes no cambia.",
    );
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const errEl = $("#admin-settings-form-error");
    if (errEl) errEl.hidden = true;
    const fd = new FormData(form);
    const idRaw = String(fd.get("id") ?? "").trim().toLowerCase();
    const name = String(fd.get("name") ?? "").trim();
    const pinRaw = String(fd.get("pin") ?? "").trim();
    if (!PARTICIPANT_ID_PATTERN.test(idRaw)) {
      if (errEl) {
        errEl.textContent =
          "El id solo puede usar letras, números, guiones y guión bajo, sin espacios.";
        errEl.hidden = false;
      }
      return;
    }
    if (!name) {
      if (errEl) {
        errEl.textContent = "Indica un nombre visible.";
        errEl.hidden = false;
      }
      return;
    }
    const existing = getParticipants();
    if (existing.some((x) => x.id === idRaw)) {
      if (errEl) {
        errEl.textContent = "Ya existe un participante con ese id.";
        errEl.hidden = false;
      }
      return;
    }
    const pin = pinRaw === "" ? null : pinRaw;
    setParticipantsList([...existing, { id: idRaw, name, pin }]);
    form.reset();
    renderAdminSettingsList();
    refreshAll(loadSession());
  });
}

/** Pestaña Predicciones generales: nadie puede editar el formulario de participante (incl. admin). */
function generalesPredictionsFormLocked() {
  return loadOfficialResults().generalPredictionsBlockedForParticipants === true;
}

/** Fase de grupos: bloqueo global de predicciones para todos (incl. admin). */
function groupPredictionsFormLocked() {
  return loadOfficialResults().groupPredictionsBlockedForAll === true;
}

function bindSessionChange(handler) {
  $("#btn-cambiar-sesion").addEventListener("click", () => {
    if (confirm("¿Cambiar de participante en este navegador? Podrás elegir otro nombre.")) {
      clearSession();
      handler();
    }
  });
}

function bindRulesQuickButton() {
  const btn = $("#btn-open-rules");
  if (!btn) return;
  btn.addEventListener("click", () => {
    tabsController?.setTab("reglas");
  });
}

/**
 * @param {string} teamName
 * @param {boolean} cellExact
 * @param {boolean} qualWrong
 * @param {boolean} hasOfficialData
 * @param {number} slotPts +5 / +2 / +3 según orden de acierto en casillas 1.º→3.º
 */
function generalesPodiumCellHtml(teamName, cellExact, qualWrong, hasOfficialData, slotPts) {
  if (!teamName) {
    return `<td class="group-preds-pos"><span class="muted">—</span></td>`;
  }
  const cls = !hasOfficialData
    ? "group-preds-pos"
    : cellExact
      ? "group-preds-pos group-preds-pos--hit"
      : qualWrong
        ? "group-preds-pos group-preds-pos--qual-hit"
        : "group-preds-pos";
  let slotTitle = "";
  if (slotPts === 5) slotTitle = "País en el podio real (1.er acierto en orden 1.º→3.º): +5";
  else if (slotPts === 2) slotTitle = "2.º país del podio acertado en tu quiniela: +2";
  else if (slotPts === 3) slotTitle = "3.er país del podio acertado en tu quiniela: +3";
  const badge =
    hasOfficialData && slotPts > 0 ? pointsBadgeHtml(slotPts, { title: slotTitle }) : "";
  return `<td class="${cls}">
    <div class="group-preds-cell-wrap generales-preds-cell--team">
      ${teamLabelHtml(teamName)}
      ${badge}
    </div>
  </td>`;
}

/**
 * @param {boolean} disabled
 */
function generalesPodiumFormFieldsHtml(teamOptions, disabled) {
  const dis = disabled ? "disabled" : "";
  const row = (name, label, medalClass, stepClass) => `
    <label class="field generales-podium-slot ${medalClass} ${stepClass}">
      <span class="field-label">${label}</span>
      <select class="input" name="${name}" ${dis}>
        <option value="">— Elegir —</option>
        ${teamOptions}
      </select>
    </label>`;
  return `
    <div class="generales-podium-pyramid" role="group" aria-label="Podio: 1.º, 2.º y 3.º">
      <div class="generales-podium-tier generales-podium-tier--champion">
        ${row("first", '<span class="generales-medal generales-medal--gold" aria-hidden="true">1.º</span> Campeón', "generales-podium-slot--gold", "generales-podium-step generales-podium-step--1")}
      </div>
      <div class="generales-podium-riser" aria-hidden="true"></div>
      <div class="generales-podium-tier generales-podium-tier--runnerups">
        ${row("second", '<span class="generales-medal generales-medal--silver" aria-hidden="true">2.º</span> Subcampeón', "generales-podium-slot--silver", "generales-podium-step generales-podium-step--2")}
        ${row("third", '<span class="generales-medal generales-medal--bronze" aria-hidden="true">3.º</span> Tercer lugar', "generales-podium-slot--bronze", "generales-podium-step generales-podium-step--3")}
      </div>
    </div>`;
}

/**
 * @param {string} teamOptions
 * @param {Record<string, string>} g
 * @param {boolean} disabled
 */
function generalesFullFormInnerHtml(teamOptions, g, disabled) {
  return `
    <div class="generales-form-layout">
      <section class="generales-block generales-block--podium" aria-label="Podio final">
        <h3 class="generales-side-title">Podio</h3>
        <div class="generales-podium-slots">
          ${generalesPodiumFormFieldsHtml(teamOptions, disabled)}
        </div>
      </section>
      <section class="generales-block generales-block--awards" aria-label="Premios individuales">
        <h3 class="generales-side-title">Premios individuales</h3>
        <div class="generales-players-fields generales-players-fields--row">
          ${generalesPlayersFormFieldsHtml(g, disabled)}
        </div>
      </section>
    </div>`;
}

function buildAwardSelectOptionsHtml(currentValue) {
  const cur = String(currentValue ?? "").trim();
  const inList = new Set(AWARD_NOMINEES);
  let orphan = "";
  if (cur && !inList.has(cur)) {
    orphan = `<option value="${escapeHtml(cur)}">${escapeHtml(cur)} · fuera de lista</option>`;
  }
  const opts = AWARD_NOMINEES.map(
    (n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`,
  ).join("");
  return `<option value="">— Elegir —</option>${orphan}${opts}`;
}

/**
 * Impide repetir el mismo país en 1.º / 2.º / 3.º (intercambia con el valor previo del slot editado).
 * @param {HTMLFormElement} form
 * @param {() => void} onCommit tras normalizar y guardar
 */
function wireGeneralesPodiumNoDuplicate(form, onCommit) {
  const slotNames = ["first", "second", "third"];
  for (const name of slotNames) {
    const sel = form.querySelector(`select[name="${name}"]`);
    if (!sel || sel.disabled) continue;
    sel.addEventListener("focus", () => {
      sel.dataset.prevPodiumPick = sel.value;
    });
    sel.addEventListener("change", () => {
      if (sel.disabled) return;
      const prevSelf = sel.dataset.prevPodiumPick ?? "";
      const newVal = sel.value;
      const selects = slotNames.map((n) => form.querySelector(`select[name="${n}"]`));
      const currentIdx = slotNames.indexOf(name);
      if (newVal !== "") {
        const dupIdx = selects.findIndex(
          (s, i) => s && i !== currentIdx && s.value === newVal,
        );
        if (dupIdx >= 0 && selects[dupIdx]) {
          selects[dupIdx].value = prevSelf;
          selects[dupIdx].dataset.prevPodiumPick = selects[dupIdx].value;
        }
      }
      sel.dataset.prevPodiumPick = newVal;
      onCommit();
    });
  }
}

function readGeneralFormPayload(form) {
  const fd = new FormData(form);
  return {
    first: String(fd.get("first") ?? ""),
    second: String(fd.get("second") ?? ""),
    third: String(fd.get("third") ?? ""),
    bestPlayer: String(fd.get("bestPlayer") ?? ""),
    bestGk: String(fd.get("bestGk") ?? ""),
    topScorer: String(fd.get("topScorer") ?? ""),
  };
}

/**
 * @param {Record<string, string>} g
 * @param {boolean} disabled
 */
function generalesPlayersFormFieldsHtml(g, disabled) {
  const dis = disabled ? "disabled" : "";
  return `
    <label class="field generales-award-slot generales-award-slot--player">
      <span class="field-label">Mejor jugador</span>
      <select class="input" name="bestPlayer" ${dis}>
        ${buildAwardSelectOptionsHtml(g.bestPlayer)}
      </select>
    </label>
    <label class="field generales-award-slot generales-award-slot--gk">
      <span class="field-label">Mejor portero</span>
      <select class="input" name="bestGk" ${dis}>
        ${buildAwardSelectOptionsHtml(g.bestGk)}
      </select>
    </label>
    <label class="field generales-award-slot generales-award-slot--scorer">
      <span class="field-label">Goleador del torneo</span>
      <select class="input" name="topScorer" ${dis}>
        ${buildAwardSelectOptionsHtml(g.topScorer)}
      </select>
    </label>`;
}

/**
 * @param {string} text
 * @param {number} awardPts
 * @param {boolean} hasOfficialData
 */
function generalesTextAwardCellHtml(text, awardPts, hasOfficialData) {
  const t = String(text ?? "").trim();
  const hit = hasOfficialData && awardPts > 0;
  const cls = [
    "group-preds-pos",
    "generales-preds-text",
    hit ? "group-preds-pos--hit" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const inner = t ? escapeHtml(t) : '<span class="muted">—</span>';
  const badge =
    hit && awardPts > 0
      ? pointsBadgeHtml(awardPts, { title: `Premio acertado (+${INDIVIDUAL_AWARD_POINTS})` })
      : "";
  return `<td class="${cls}">
    <div class="group-preds-cell-wrap generales-preds-cell--text">
      ${inner}
      ${badge}
    </div>
  </td>`;
}

/**
 * @param {string} currentParticipantId
 */
function buildGeneralesPredictionsTableHtml(currentParticipantId) {
  const officialStore = loadOfficialResults();
  const officialGen = officialStore.generalOfficial ?? {};
  const hasOfficialData =
    officialStore.generalOfficialConfirmed === true &&
    Boolean(String(officialGen.first ?? "").trim()) &&
    Boolean(String(officialGen.second ?? "").trim()) &&
    Boolean(String(officialGen.third ?? "").trim());

  const draftHasAny =
    Boolean(String(officialGen.first ?? "").trim()) ||
    Boolean(String(officialGen.second ?? "").trim()) ||
    Boolean(String(officialGen.third ?? "").trim()) ||
    Boolean(String(officialGen.bestPlayer ?? "").trim()) ||
    Boolean(String(officialGen.bestGk ?? "").trim()) ||
    Boolean(String(officialGen.topScorer ?? "").trim());

  const showDraftOfficialRow =
    !hasOfficialData &&
    (officialStore.generalPredictionsBlockedForParticipants === true || draftHasAny);

  const dash = `<td class="group-preds-pos"><span class="muted">—</span></td>`;
  let officialRowHtml;
  if (hasOfficialData) {
    officialRowHtml = `<tr class="group-preds-row group-preds-row--official">
      <th scope="row" class="group-preds-name-col">Resultado oficial</th>
      <td class="group-preds-pos"><div class="group-preds-cell-wrap generales-preds-cell--team">${officialGen.first ? teamLabelHtml(officialGen.first) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos"><div class="group-preds-cell-wrap generales-preds-cell--team">${officialGen.second ? teamLabelHtml(officialGen.second) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos"><div class="group-preds-cell-wrap generales-preds-cell--team">${officialGen.third ? teamLabelHtml(officialGen.third) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos generales-preds-text"><div class="group-preds-cell-wrap generales-preds-cell--text">${officialGen.bestPlayer ? escapeHtml(officialGen.bestPlayer) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos generales-preds-text"><div class="group-preds-cell-wrap generales-preds-cell--text">${officialGen.bestGk ? escapeHtml(officialGen.bestGk) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos generales-preds-text"><div class="group-preds-cell-wrap generales-preds-cell--text">${officialGen.topScorer ? escapeHtml(officialGen.topScorer) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pts"><span class="muted">—</span></td>
    </tr>`;
  } else if (showDraftOfficialRow) {
    officialRowHtml = `<tr class="group-preds-row group-preds-row--official group-preds-row--official-draft">
      <th scope="row" class="group-preds-name-col">Resultado oficial <span class="td-muted">(borrador)</span></th>
      <td class="group-preds-pos"><div class="group-preds-cell-wrap generales-preds-cell--team">${officialGen.first ? teamLabelHtml(officialGen.first) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos"><div class="group-preds-cell-wrap generales-preds-cell--team">${officialGen.second ? teamLabelHtml(officialGen.second) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos"><div class="group-preds-cell-wrap generales-preds-cell--team">${officialGen.third ? teamLabelHtml(officialGen.third) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos generales-preds-text"><div class="group-preds-cell-wrap generales-preds-cell--text">${officialGen.bestPlayer ? escapeHtml(officialGen.bestPlayer) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos generales-preds-text"><div class="group-preds-cell-wrap generales-preds-cell--text">${officialGen.bestGk ? escapeHtml(officialGen.bestGk) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pos generales-preds-text"><div class="group-preds-cell-wrap generales-preds-cell--text">${officialGen.topScorer ? escapeHtml(officialGen.topScorer) : '<span class="muted">—</span>'}</div></td>
      <td class="group-preds-pts"><span class="muted">—</span></td>
    </tr>`;
  } else {
    officialRowHtml = `<tr class="group-preds-row group-preds-row--official group-preds-row--official-pending">
      <th scope="row" class="group-preds-name-col">Resultado oficial <span class="td-muted">(pendiente)</span></th>
      ${dash}${dash}${dash}${dash}${dash}${dash}
      <td class="group-preds-pts"><span class="muted">—</span></td>
    </tr>`;
  }

  const participantScores = [...getParticipants()].map((p) => {
    const gen = loadPredictions(p.id).general ?? {};
    const score = computeGeneralPredictionsScore(gen, officialGen, hasOfficialData);
    return { p, gen, score };
  });
  const maxPts = Math.max(0, ...participantScores.map((x) => x.score.total));

  const participantRows = participantScores
    .sort((a, b) => a.p.name.localeCompare(b.p.name))
    .map(({ p, gen, score }) => {
      const rowClasses = ["group-preds-row", p.id === currentParticipantId ? "row-self" : ""]
        .filter(Boolean)
        .join(" ");
      const you = p.id === currentParticipantId ? ' <span class="td-muted">(tú)</span>' : "";
      let exactTierUnder = "";
      if (hasOfficialData && score.exactTierLabel && score.exactTierPts > 0) {
        const tierMeta = {
          bien: { word: "Bien", cls: "generales-tier-label--bien" },
          excelente: { word: "Excelente", cls: "generales-tier-label--excelente" },
          perfecto: { word: "Perfecto", cls: "generales-tier-label--perfecto" },
        }[score.exactTierLabel];
        if (tierMeta) {
          exactTierUnder = `<div class="quiniela-perfect-inline group-preds-order-bonus-inline generales-exact-tier" role="status" aria-label="${escapeHtml(tierMeta.word)}">
            <span class="generales-tier-label ${tierMeta.cls}">${tierMeta.word}</span>
            ${pointsBadgeHtml(score.exactTierPts, { title: "Bonus por posiciones exactas en el podio (1→+2, 2→+4, 3→+6)" })}
          </div>`;
        }
      }
      const ptsTdClass =
        maxPts > 0 && score.total === maxPts ? "group-preds-pts group-preds-pts--top" : "group-preds-pts";

      const c1 = generalesPodiumCellHtml(
        String(gen.first ?? "").trim(),
        score.cellExact.first,
        score.cellQualWrongPos.first,
        hasOfficialData,
        score.cellPodiumPts.first,
      );
      const c2 = generalesPodiumCellHtml(
        String(gen.second ?? "").trim(),
        score.cellExact.second,
        score.cellQualWrongPos.second,
        hasOfficialData,
        score.cellPodiumPts.second,
      );
      const c3 = generalesPodiumCellHtml(
        String(gen.third ?? "").trim(),
        score.cellExact.third,
        score.cellQualWrongPos.third,
        hasOfficialData,
        score.cellPodiumPts.third,
      );
      const ta = generalesTextAwardCellHtml(gen.bestPlayer, score.cellAwardPts.bestPlayer, hasOfficialData);
      const tb = generalesTextAwardCellHtml(gen.bestGk, score.cellAwardPts.bestGk, hasOfficialData);
      const tc = generalesTextAwardCellHtml(gen.topScorer, score.cellAwardPts.topScorer, hasOfficialData);

      return `<tr class="${rowClasses}">
        <th scope="row" class="group-preds-name-col">
          <div class="quiniela-participant-cell">
            <div class="quiniela-participant-line">${escapeHtml(p.name)}${you}</div>
            ${exactTierUnder}
          </div>
        </th>
        ${c1}${c2}${c3}${ta}${tb}${tc}
        <td class="${ptsTdClass}">${hasOfficialData ? score.total : "—"}</td>
      </tr>`;
    })
    .join("");

  return `
    <h2 class="subsection-title group-preds-table-title">Predicciones de todos · generales</h2>
    <p class="muted group-preds-legend generales-preds-legend"><span class="group-preds-legend-swatch group-preds-legend-swatch--cell"></span> En cada casilla del podio: botón <span class="group-preds-pt-badge">+5</span> / <span class="group-preds-pt-badge">+2</span> / <span class="group-preds-pt-badge">+3</span> según 1.º, 2.º y 3.er país acertado en el podio real (en cualquier puesto, en orden de tus columnas)
      · Bajo el nombre solo aparece <strong class="group-preds-bien-intro">Bien</strong> (+2), <strong class="generales-legend-excelente">Excelente</strong> (+4) o <strong class="quiniela-perfect-intro-gold">Perfecto</strong> (+6) por 1, 2 o 3 posiciones exactas
      · <span class="group-preds-legend-swatch group-preds-legend-swatch--qual"></span> País en el podio pero en otra casilla (sin posición exacta)
      · Premios individuales: <span class="group-preds-pt-badge">+3</span> por acierto
      · <span class="group-preds-legend-swatch group-preds-legend-swatch--pts-lead"></span> <strong>Pts</strong> dorado = líder(es) en esta sección</p>
    <div class="table-scroll table-scroll--group-preds">
      <table class="table table-compact table-group-preds table-generales-preds" aria-label="Predicciones generales: todas las personas">
        <thead>
          <tr>
            <th scope="col">Participante</th>
            <th scope="col">1.º</th>
            <th scope="col">2.º</th>
            <th scope="col">3.º</th>
            <th scope="col">Mejor jugador</th>
            <th scope="col">Mejor portero</th>
            <th scope="col">Goleador</th>
            <th scope="col" class="group-preds-pts">Pts</th>
          </tr>
        </thead>
        <tbody>${officialRowHtml}${participantRows}</tbody>
      </table>
    </div>`;
}

/**
 * @param {string} participantId
 */
function renderGeneralesComparisonTable(participantId) {
  const host = $("#generales-preds-host");
  if (!host) return;
  host.innerHTML = buildGeneralesPredictionsTableHtml(participantId);
}

/**
 * @param {string} participantId
 */
function renderGeneralesOfficialAdmin(participantId) {
  const wrap = $("#generales-official-admin");
  if (!wrap || !canEditOfficialResults(participantId)) {
    if (wrap) {
      wrap.hidden = true;
      wrap.innerHTML = "";
    }
    return;
  }

  const teams = [...new Set(GROUPS.flatMap((x) => x.teams))].filter((t) => !isPlaceholderTeam(t));
  const teamOptions = teams
    .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
    .join("");
  const officialStore = loadOfficialResults();
  const g = officialStore.generalOfficial ?? {};
  const confirmed = officialStore.generalOfficialConfirmed === true;
  const genBlocked = officialStore.generalPredictionsBlockedForParticipants === true;
  /** Solo en fase «borrador»: predicciones bloqueadas y resultado oficial editable. */
  const adminOfficialFormDisabled = confirmed || !genBlocked;

  wrap.hidden = false;
  const lockSectionHtml = confirmed
    ? `<section class="generales-admin-lock generales-admin-lock--published" aria-labelledby="generales-admin-lock-heading">
        <h3 id="generales-admin-lock-heading" class="generales-admin-lock__title">Resultado oficial publicado</h3>
        <p class="generales-admin-status muted" role="status">
          El podio y los premios están <strong>cerrados</strong>: la tabla compara todas las predicciones con este resultado. Para editar de nuevo el resultado real, desconfirma primero.
        </p>
        <div class="generales-admin-lock__actions">
          <button type="button" class="btn btn-sm" data-gen-admin="unlock-official">Desconfirmar resultados</button>
        </div>
      </section>`
    : `<section class="generales-admin-lock" aria-labelledby="generales-admin-lock-heading">
        <h3 id="generales-admin-lock-heading" class="generales-admin-lock__title">Flujo resultado oficial</h3>
        <p id="generales-admin-lock-status" class="muted"></p>
        <div class="generales-admin-lock__actions">
          ${
            !genBlocked
              ? `<button type="button" class="btn btn-primary btn-sm" data-gen-admin="block-preds">Bloquear predicciones</button>`
              : `<button type="button" class="btn btn-sm" data-gen-admin="unblock-preds">Desbloquear predicciones</button>
                 <button type="button" class="btn btn-primary btn-sm" data-gen-admin="confirm-official">Confirmar resultados</button>`
          }
        </div>
      </section>`;

  wrap.innerHTML = `
    <article class="card card--generales-admin">
      <h2 class="card-title">Resultado oficial (admin)</h2>
      <p class="muted card-sub">Primero bloquea predicciones. Luego edita y confirma el resultado oficial.</p>
      ${lockSectionHtml}
      <form id="form-generales-official" class="generales-form-layout generales-form-layout--admin">
        ${generalesFullFormInnerHtml(teamOptions, g, adminOfficialFormDisabled)}
      </form>
    </article>`;

  const form = $("#form-generales-official");
  if (!form) return;

  for (const key of ["first", "second", "third", "bestPlayer", "bestGk", "topScorer"]) {
    const el = form.querySelector(`[name="${key}"]`);
    if (el) el.value = String(g[key] ?? "");
  }

  function commitOfficialDraft() {
    saveOfficialResults({
      generalOfficial: readGeneralFormPayload(form),
      generalOfficialConfirmed: false,
    });
    renderGeneralesComparisonTable(participantId);
    renderStats(loadSession());
  }

  if (!adminOfficialFormDisabled) {
    wireGeneralesPodiumNoDuplicate(form, commitOfficialDraft);
    form.addEventListener("change", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLSelectElement)) return;
      if (["first", "second", "third"].includes(t.name)) return;
      commitOfficialDraft();
    });
  }

  const lockStatusEl = $("#generales-admin-lock-status");
  if (lockStatusEl) {
    if (!genBlocked) {
      lockStatusEl.textContent = "Ahora todos pueden editar. Pulsa Bloquear para cargar el resultado oficial.";
    } else {
      lockStatusEl.textContent = "Predicciones bloqueadas. Edita aqui el resultado oficial y confirmalo cuando este listo.";
    }
  }

}

/**
 * Un solo listener en el contenedor admin: los botones se recrean en cada render y la delegación evita fallos al confirmar / desconfirmar.
 */
function bindGeneralesOfficialAdminActions() {
  const wrap = $("#generales-official-admin");
  if (!wrap || wrap.dataset.genOfficialActionsBound) return;
  wrap.dataset.genOfficialActionsBound = "1";
  wrap.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const trigger = t.closest("[data-gen-admin]");
    if (!trigger) return;
    const action = trigger.getAttribute("data-gen-admin");
    const session = loadSession();
    if (!session || !canEditOfficialResults(session.participantId)) return;
    const participantId = session.participantId;
    const formEl = /** @type {HTMLFormElement | null} */ (wrap.querySelector("#form-generales-official"));

    if (action === "block-preds") {
      if (
        !confirm(
          "¿Bloquear predicciones? Nadie podrá cambiar podio ni premios en su formulario de participante hasta que desbloquees o confirmes el resultado oficial.",
        )
      ) {
        return;
      }
      saveOfficialResults({
        generalPredictionsBlockedForParticipants: true,
        generalOfficialConfirmed: false,
      });
      refreshAll(loadSession());
      return;
    }
    if (action === "unblock-preds") {
      saveOfficialResults({ generalPredictionsBlockedForParticipants: false });
      refreshAll(loadSession());
      return;
    }
    if (action === "confirm-official") {
      if (!formEl) return;
      const o = readGeneralFormPayload(formEl);
      if (!String(o.first).trim() || !String(o.second).trim() || !String(o.third).trim()) {
        alert("Rellena al menos 1.º, 2.º y 3.º del podio antes de confirmar.");
        return;
      }
      saveOfficialResults({
        generalOfficial: o,
        generalOfficialConfirmed: true,
        generalPredictionsBlockedForParticipants: false,
      });
      renderGenerales(participantId, loadPredictions(participantId), false);
      renderStats(loadSession());
      return;
    }
    if (action === "unlock-official") {
      saveOfficialResults({
        generalOfficialConfirmed: false,
        generalPredictionsBlockedForParticipants: false,
      });
      refreshGeneralesAfterOfficialUnlock(participantId);
    }
  });
}

/** Sin re montar el formulario de usuario solo para quitar «confirmado» del admin. */
function refreshGeneralesAfterOfficialUnlock(participantId) {
  renderGeneralesOfficialAdmin(participantId);
  renderGeneralesComparisonTable(participantId);
  renderStats(loadSession());
}

function renderGenerales(participantId, predictions, disabled) {
  const form = $("#form-generales");
  const g = predictions.general;
  const official = loadOfficialResults();
  const officialLocked = official.generalOfficialConfirmed === true;
  const isAdmin = canEditOfficialResults(participantId);
  const formDisabled = disabled || officialLocked || generalesPredictionsFormLocked();
  const teams = [...new Set(GROUPS.flatMap((x) => x.teams))].filter((t) => !isPlaceholderTeam(t));
  const teamOptions = teams
    .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
    .join("");

  const lockBanner = officialLocked
    ? `<p class="generales-locked-banner muted" role="status">El resultado oficial está <strong>confirmado</strong>. No puedes cambiar tus predicciones hasta que un administrador desconfirme.</p>`
    : generalesPredictionsFormLocked()
      ? isAdmin
        ? `<p class="generales-locked-banner generales-locked-banner--admin muted" role="status">Tus predicciones de participante están <strong>bloqueadas</strong> mientras defines el resultado oficial. Usa el panel <strong>Resultado oficial (admin)</strong> más abajo.</p>`
        : `<p class="generales-locked-banner muted" role="status">Un administrador ha <strong>bloqueado</strong> esta pestaña: no puedes cambiar el podio ni los premios individuales hasta que lo desbloqueen.</p>`
      : "";

  form.innerHTML = `${lockBanner}
    ${generalesFullFormInnerHtml(teamOptions, g, formDisabled)}`;

  for (const key of ["first", "second", "third", "bestPlayer", "bestGk", "topScorer"]) {
    const el = form.querySelector(`[name="${key}"]`);
    if (el) el.value = g[key] ?? "";
  }

  if (generalesUserAwardChangeHandler) {
    form.removeEventListener("change", generalesUserAwardChangeHandler);
    generalesUserAwardChangeHandler = null;
  }
  if (!formDisabled) {
    function commitUserGenerales() {
      savePredictions(participantId, { general: readGeneralFormPayload(form) });
      renderGeneralesComparisonTable(participantId);
      renderStats(loadSession());
    }
    wireGeneralesPodiumNoDuplicate(form, commitUserGenerales);
    generalesUserAwardChangeHandler = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLSelectElement)) return;
      if (["first", "second", "third"].includes(t.name)) return;
      commitUserGenerales();
    };
    form.addEventListener("change", generalesUserAwardChangeHandler);
  }

  renderGeneralesOfficialAdmin(participantId);
  renderGeneralesComparisonTable(participantId);
}

function countBestThirdsYes(pred) {
  return Object.values(pred.groupThirdAdvances ?? {}).filter((v) => v === true).length;
}

function hideGroupBestThirdSummary() {
  const el = $("#group-best-third-summary");
  if (!el) return;
  el.innerHTML = "";
  el.hidden = true;
  el.classList.remove("group-best-third-summary--full");
}

/**
 * @param {HTMLElement} parent
 * @param {ReturnType<typeof loadPredictions>} pred
 */
function appendBestThirdSummaryEl(parent, pred) {
  const el = document.createElement("div");
  el.id = "group-best-third-summary";
  el.className = "group-best-third-summary group-best-third-summary--in-card";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  parent.appendChild(el);
  /** `card` aún puede no estar en el documento: no usar querySelector global aquí. */
  fillGroupBestThirdSummary(el, pred);
}

function syncThirdLimitRibbon(pred) {
  const m = $("#group-third-limit-msg");
  if (!m) return;
  if (countBestThirdsYes(pred) >= MAX_BEST_THIRD_TEAMS) {
    m.textContent = `Ya elegiste el maximo de mejores terceros (${MAX_BEST_THIRD_TEAMS}).`;
    m.hidden = false;
  } else {
    m.hidden = true;
    m.textContent = "";
  }
}

/**
 * @param {HTMLElement} el
 * @param {ReturnType<typeof loadPredictions>} pred
 */
function fillGroupBestThirdSummary(el, pred) {
  const n = countBestThirdsYes(pred);
  el.hidden = false;
  el.setAttribute("aria-label", `${n} de ${MAX_BEST_THIRD_TEAMS} mejores terceros marcados con pasa`);
  el.innerHTML = `
    <div class="group-best-third-summary__main">
      <span class="group-best-third-summary__title">Mejores 3.º (✓)</span>
      <span class="group-best-third-summary__fraction"><strong>${n}</strong><span class="group-best-third-summary__sep">/</span><span class="group-best-third-summary__den">${MAX_BEST_THIRD_TEAMS}</span></span>
    </div>
    <p class="group-best-third-summary__hint">Máximo <strong>${MAX_BEST_THIRD_TEAMS}</strong> entre todos los grupos.</p>`;
  el.classList.toggle("group-best-third-summary--full", n >= MAX_BEST_THIRD_TEAMS);
}

function syncGroupBestThirdSummary(pred) {
  const el = $("#group-best-third-summary");
  if (!el) return;
  fillGroupBestThirdSummary(el, pred);
}

function applyThirdYesButtonCap(pred, groupId, yesBtn) {
  const thirdYes = pred.groupThirdAdvances?.[groupId] === true;
  const n = countBestThirdsYes(pred);
  const atCap = n >= MAX_BEST_THIRD_TEAMS;
  yesBtn.disabled = atCap && !thirdYes;
  yesBtn.title =
    atCap && !thirdYes
      ? `Ya elegiste ${MAX_BEST_THIRD_TEAMS} grupos con 3.º que pasa. Quita un ✓ en otro grupo antes de añadir otro.`
      : "Sí pasa";
}

function renderGrupos(participantId, predictions) {
  const wrap = $("#grupos-wrap");
  wrap.innerHTML = "";
  const thirdMsg = $("#group-third-limit-msg");
  const MAX_GROUP_TEAMS = 4;
  const isAdmin = canEditOfficialResults(participantId);
  const groupsBlocked = groupPredictionsFormLocked();

  ensureFaseGruposFilter();
  const filterEl = $("#fase-grupos-filter");
  const selectedGid = filterEl?.value ?? "";
  if (!selectedGid) {
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = "Elige un grupo para ver tu orden y compararlo con el resto.";
    wrap.appendChild(hint);
    appendBestThirdSummaryEl(wrap, predictions);
    syncThirdLimitRibbon(predictions);
    return;
  }
  const grp = GROUPS.find((g) => g.id === selectedGid);
  if (!grp) {
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = "Grupo no válido.";
    wrap.appendChild(hint);
    appendBestThirdSummaryEl(wrap, predictions);
    syncThirdLimitRibbon(predictions);
    return;
  }

  function selectedBestThirdCount() {
    return countBestThirdsYes(predictions);
  }

  /** @param {string} groupId */
  function wouldExceedThirdAdvanceCap(groupId, nextIsYes) {
    const adv = predictions.groupThirdAdvances ?? {};
    const currentYes = Object.values(adv).filter((v) => v === true).length;
    const wasYes = adv[groupId] === true;
    if (!nextIsYes) return false;
    if (wasYes) return currentYes > MAX_BEST_THIRD_TEAMS;
    return currentYes + 1 > MAX_BEST_THIRD_TEAMS;
  }

  function showThirdLimitMessage() {
    if (!thirdMsg) return;
    thirdMsg.textContent = `Ya elegiste el maximo de mejores terceros (${MAX_BEST_THIRD_TEAMS}).`;
    thirdMsg.hidden = false;
  }

  function showGroupMessage(msg) {
    if (!thirdMsg) return;
    thirdMsg.textContent = msg;
    thirdMsg.hidden = false;
  }

  function hideThirdLimitMessage() {
    if (!thirdMsg) return;
    thirdMsg.hidden = true;
    thirdMsg.textContent = "";
  }

  const card = document.createElement("article");
  card.className = "card";
  const savedOrder = predictions.groupOrder[grp.id];
    const order =
      Array.isArray(savedOrder) && savedOrder.length === 4
        ? savedOrder.map((x) => (typeof x === "string" ? x : ""))
        : ["", "", "", ""];
    const groupConfirmed = predictions.groupOrderConfirmed?.[grp.id] === true;

    const orderKickoffLocked = GROUP_MATCHES.some(
      (m) => m.groupId === grp.id && isLockedAtKickoff(m.kickoff),
    );
    const orderLocked = groupsBlocked || orderKickoffLocked || groupConfirmed;

    card.innerHTML = `<h2 class="card-title">Grupo ${grp.id}</h2>`;

    if (isAdmin) {
      const adminLock = document.createElement("div");
      adminLock.className = "group-admin-lock";
      adminLock.innerHTML = `
        <p class="group-admin-lock__title">Bloqueo global de predicciones (Fase de grupos)</p>
        <div class="group-admin-lock__actions">
          ${
            groupsBlocked
              ? `<button type="button" class="btn btn-sm" data-group-admin-lock="off">Desbloquear para todos</button>`
              : `<button type="button" class="btn btn-sm" data-group-admin-lock="on">Bloquear para todos</button>`
          }
        </div>
        <p class="muted group-admin-lock__status">${
          groupsBlocked
            ? "Actualmente bloqueado: nadie puede editar orden ni marcadores predichos de grupos."
            : "Actualmente desbloqueado: todos pueden editar sus predicciones de grupos."
        }</p>
      `;
      card.appendChild(adminLock);
    } else if (groupsBlocked) {
      const blocked = document.createElement("p");
      blocked.className = "generales-locked-banner muted";
      blocked.setAttribute("role", "status");
      blocked.innerHTML =
        "Un administrador ha <strong>bloqueado</strong> la fase de grupos: no puedes editar orden ni marcadores predichos hasta que lo desbloquee.";
      card.appendChild(blocked);
    }

    const teamsBar = document.createElement("div");
    teamsBar.className = "group-teams-bar";
    teamsBar.innerHTML = `
      <span class="muted">Equipos:</span>
      ${grp.teams.map((t) => `<span class="group-team">${teamLabelHtml(t)}</span>`).join("")}
    `;
    card.appendChild(teamsBar);

    const orderWrap = document.createElement("div");
    orderWrap.className = "group-order";
    orderWrap.innerHTML = `<p class="field-label">Tu orden predicho (1.º arriba)</p>`;

    const thirdChecked = predictions.groupThirdAdvances?.[grp.id] === true;
    if (orderLocked) {
      orderWrap.innerHTML += `<ol class="order-readonly">${order
        .map((t, idx) => {
          const thirdBadge =
            idx === 2
              ? `<span class="third-inline-lock ${thirdChecked ? "is-on" : ""}">${thirdChecked ? "3.º pasa ✓" : "3.º no pasa ✕"}</span>`
              : "";
          return `<li>${t ? teamLabelHtml(t) : '<span class="muted">Sin elegir</span>'}${thirdBadge}</li>`;
        })
        .join("")}</ol>`;
      if (groupConfirmed && !orderKickoffLocked) {
        orderWrap.innerHTML += `
          <div class="group-order-actions">
            <button type="button" class="btn btn-sm group-order-unlock" data-group="${grp.id}">Cambiar orden</button>
          </div>
        `;
      } else if (groupsBlocked) {
        orderWrap.innerHTML += `<p class="muted">Bloqueado por administración.</p>`;
      } else if (orderKickoffLocked) {
        orderWrap.innerHTML += `<p class="muted">Cerrado por inicio de partidos.</p>`;
      }
    } else {
      const ol = document.createElement("ol");
      ol.className = "order-list";
      order.forEach((team, idx) => {
        const li = document.createElement("li");
        li.className = "order-row";
        const pos = document.createElement("span");
        pos.className = "order-pos";
        pos.textContent = `${idx + 1}°`;
        li.appendChild(pos);
        const sel = document.createElement("select");
        sel.className = "input input-sm";
        sel.dataset.role = "order";
        sel.dataset.group = grp.id;
        sel.dataset.index = String(idx);
        const placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
        placeholderOpt.textContent = "— Elegir equipo —";
        sel.appendChild(placeholderOpt);
        grp.teams.forEach((t) => {
          const o = document.createElement("option");
          o.value = t;
          o.textContent = t;
          sel.appendChild(o);
        });
        sel.value = team;
        sel.addEventListener("change", () => {
          if (groupPredictionsFormLocked()) return;
          const selects = Array.from(ol.querySelectorAll("select[data-role=order]"));
          const currentIdx = selects.indexOf(sel);
          const prevVal = order[currentIdx] ?? "";
          const newVal = sel.value;
          if (newVal !== "") {
            const dupIdx = selects.findIndex((s, idx2) => idx2 !== currentIdx && s.value === newVal);
            if (dupIdx >= 0) {
              selects[dupIdx].value = prevVal;
            }
          }
          hideThirdLimitMessage();
          const newOrder = selects.map((s) => s.value);
          order.splice(0, order.length, ...newOrder);
          savePredictions(participantId, { groupOrder: { [grp.id]: newOrder } });
          const uniquePicked = new Set(newOrder.filter(Boolean)).size;
          const currentCard = sel.closest(".card");
          const confirmBtn = currentCard?.querySelector(`.group-order-confirm[data-group="${grp.id}"]`);
          if (confirmBtn) {
            const thirdPicked = predictions.groupThirdAdvances?.[grp.id];
            const hasThirdChoice = thirdPicked === true || thirdPicked === false;
            confirmBtn.disabled = !(uniquePicked === MAX_GROUP_TEAMS && hasThirdChoice);
          }
        });
        li.appendChild(sel);
        if (idx === 2) {
          const thirdWrap = document.createElement("div");
          thirdWrap.className = "third-choice";
          const thirdLabel = document.createElement("span");
          thirdLabel.className = "third-choice__label";
          thirdLabel.textContent = "3.º pasa";
          const btnRow = document.createElement("div");
          btnRow.className = "third-choice__buttons";
          btnRow.setAttribute("role", "group");
          btnRow.setAttribute("aria-label", `Grupo ${grp.id}: ¿pasa el 3.º?`);
          const yesBtn = document.createElement("button");
          yesBtn.type = "button";
          yesBtn.className = `btn btn-sm third-choice__btn third-choice__btn--yes${thirdChecked ? " is-active" : ""}`;
          yesBtn.dataset.thirdChoice = "yes";
          yesBtn.title = "Sí pasa";
          yesBtn.setAttribute("aria-pressed", thirdChecked ? "true" : "false");
          yesBtn.textContent = "✓";
          const noBtn = document.createElement("button");
          noBtn.type = "button";
          noBtn.className = `btn btn-sm third-choice__btn third-choice__btn--no${predictions.groupThirdAdvances?.[grp.id] === false ? " is-active" : ""}`;
          noBtn.dataset.thirdChoice = "no";
          noBtn.title = "No pasa";
          noBtn.setAttribute(
            "aria-pressed",
            predictions.groupThirdAdvances?.[grp.id] === false ? "true" : "false",
          );
          noBtn.textContent = "✕";
          btnRow.appendChild(yesBtn);
          btnRow.appendChild(noBtn);
          thirdWrap.appendChild(thirdLabel);
          thirdWrap.appendChild(btnRow);
          applyThirdYesButtonCap(predictions, grp.id, yesBtn);
          const toggleThirdChoice = (value) => {
            if (groupPredictionsFormLocked()) return;
            const isYes = value === true;
            yesBtn.classList.toggle("is-active", isYes);
            noBtn.classList.toggle("is-active", !isYes);
            yesBtn.setAttribute("aria-pressed", isYes ? "true" : "false");
            noBtn.setAttribute("aria-pressed", isYes ? "false" : "true");
            hideThirdLimitMessage();
            predictions.groupThirdAdvances = {
              ...(predictions.groupThirdAdvances ?? {}),
              [grp.id]: value,
            };
            savePredictions(participantId, { groupThirdAdvances: { [grp.id]: value } });
            syncGroupBestThirdSummary(predictions);
            syncThirdLimitRibbon(predictions);
            applyThirdYesButtonCap(predictions, grp.id, yesBtn);
            const currentCard = sel.closest(".card");
            const confirmBtn = currentCard?.querySelector(`.group-order-confirm[data-group="${grp.id}"]`);
            if (confirmBtn) {
              const selects = Array.from(ol.querySelectorAll("select[data-role=order]"));
              const newOrder = selects.map((s) => s.value);
              const uniquePicked = new Set(newOrder.filter(Boolean)).size;
              const tc = predictions.groupThirdAdvances?.[grp.id];
              const hasThirdChoice = tc === true || tc === false;
              confirmBtn.disabled = !(uniquePicked === MAX_GROUP_TEAMS && hasThirdChoice);
            }
          };
          yesBtn.addEventListener("click", () => {
            if (wouldExceedThirdAdvanceCap(grp.id, true)) {
              showThirdLimitMessage();
              return;
            }
            toggleThirdChoice(true);
          });
          noBtn.addEventListener("click", () => toggleThirdChoice(false));
          li.appendChild(thirdWrap);
        }
        ol.appendChild(li);
      });
      orderWrap.appendChild(ol);
      const uniquePicked = new Set(order.filter(Boolean)).size;
      const thirdChoice = predictions.groupThirdAdvances?.[grp.id];
      const hasThirdChoice = thirdChoice === true || thirdChoice === false;
      const canConfirm = uniquePicked === grp.teams.length && hasThirdChoice;
      const actions = document.createElement("div");
      actions.className = "group-order-actions group-order-actions--align-select";
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "btn btn-primary btn-sm group-order-confirm";
      confirmBtn.dataset.group = grp.id;
      confirmBtn.textContent = "Confirmar orden";
      confirmBtn.disabled = !canConfirm;
      actions.appendChild(confirmBtn);
      orderWrap.appendChild(actions);
    }

    card.appendChild(orderWrap);

    appendBestThirdSummaryEl(card, predictions);

    const predsHost = document.createElement("div");
    predsHost.className = "group-preds-host";
    predsHost.innerHTML = buildGroupPredictionsTableHtml(grp, participantId);
    card.appendChild(predsHost);
    wrap.appendChild(card);

  wrap.querySelectorAll(".group-order-confirm").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (groupPredictionsFormLocked()) return;
      const gid = btn.dataset.group;
      if (!gid) return;
      const latest = loadPredictions(participantId);
      const order = latest.groupOrder?.[gid] ?? [];
      const uniquePicked = new Set(order.filter(Boolean)).size;
      if (uniquePicked !== MAX_GROUP_TEAMS) {
        showGroupMessage("Completa las 4 posiciones sin repetir equipos antes de confirmar.");
        return;
      }
      const thirdChoice = latest.groupThirdAdvances?.[gid];
      if (thirdChoice !== true && thirdChoice !== false) {
        showGroupMessage("Debes elegir si el 3.º pasa (✓) o no pasa (✕) antes de confirmar.");
        return;
      }
      const selectedThirds = Object.values(latest.groupThirdAdvances ?? {}).filter(Boolean).length;
      if (thirdChoice === true && selectedThirds > MAX_BEST_THIRD_TEAMS) {
        showThirdLimitMessage();
        return;
      }
      hideThirdLimitMessage();
      savePredictions(participantId, { groupOrderConfirmed: { [gid]: true } });
      refreshAll(loadSession());
    });
  });

  wrap.querySelectorAll(".group-order-unlock").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (groupPredictionsFormLocked()) return;
      const gid = btn.dataset.group;
      if (!gid) return;
      savePredictions(participantId, { groupOrderConfirmed: { [gid]: false } });
      refreshAll(loadSession());
    });
  });

  wrap.querySelectorAll("[data-group-admin-lock]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!canEditOfficialResults(participantId)) return;
      const to = btn.dataset.groupAdminLock === "on";
      const q = to
        ? "¿Bloquear predicciones de Fase de grupos para todos, incluido Tivo?"
        : "¿Desbloquear predicciones de Fase de grupos para todos?";
      if (!confirm(q)) return;
      saveOfficialResults({ groupPredictionsBlockedForAll: to });
      refreshAll(loadSession());
    });
  });

  syncThirdLimitRibbon(predictions);
}

/**
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {number} roundIndex
 * @param {number} matchIndex
 * @param {boolean} isAdmin
 * @param {Record<string, { home: number|string|"", away: number|string|"" }>} offResolveMap
 * @param {Record<string, string>} [liveR32SlotMap]
 */
function bracketPairBlockHtml(official, roundIndex, matchIndex, isAdmin, offResolveMap, liveR32SlotMap) {
  const m = KNOCKOUT_ROUNDS[roundIndex].matches[matchIndex];
  const offSc = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
  const offOk = official.knockoutScoresConfirmed?.[m.id] === true;
  const homeResolved = resolveKnockoutSlotLabel(roundIndex, matchIndex, "home", offResolveMap);
  const awayResolved = resolveKnockoutSlotLabel(roundIndex, matchIndex, "away", offResolveMap);
  const homeL =
    roundIndex === KNOCKOUT_PHASE_ROUND_INDEX.r32
      ? (liveR32SlotMap?.[`${m.id}:home`] ?? homeResolved)
      : homeResolved;
  const awayL =
    roundIndex === KNOCKOUT_PHASE_ROUND_INDEX.r32
      ? (liveR32SlotMap?.[`${m.id}:away`] ?? awayResolved)
      : awayResolved;
  const win =
    offSc.home !== "" && offSc.away !== "" ? winnerSideFromKnockoutScore(offSc) : null;
  const gh = offSc.home !== "" ? escapeHtml(String(offSc.home)) : "—";
  const ga = offSc.away !== "" ? escapeHtml(String(offSc.away)) : "—";
  const canConfirmOff = offSc.home !== "" && offSc.away !== "" && !offOk;
  const adminBlock = isAdmin
    ? `<div class="bracket-pair-admin">
        <div class="match-goals match-goals--steppers bracket-admin-steppers">
          ${scoreStepperHtml(m.id, "home", offSc.home, { disabled: false, idAttr: "data-okid", extraClass: "score-stepper--tight" })}
          <span class="dash">—</span>
          ${scoreStepperHtml(m.id, "away", offSc.away, { disabled: false, idAttr: "data-okid", extraClass: "score-stepper--tight" })}
        </div>
        <div class="bracket-official-actions">
          ${
            offOk
              ? `<button type="button" class="btn btn-ghost btn-sm" data-ko-unconfirm="${escapeHtml(m.id)}">Desconfirmar</button>`
              : `<button type="button" class="btn btn-primary btn-sm" data-ko-confirm="${escapeHtml(m.id)}" ${canConfirmOff ? "" : "disabled"}>Confirmar</button>`
          }
        </div>
      </div>`
    : "";
  return `
    <div class="bracket-pair" data-match-id="${escapeHtml(m.id)}">
      <div class="bracket-slot-row${win === "home" ? " is-winner" : ""}">
        <span class="bracket-slot-dot" aria-hidden="true"></span>
        <div class="bracket-slot-main">${bracketTeamLineHtml(homeL, { winner: win === "home" })}</div>
        <span class="bracket-slot-goal">${gh}</span>
      </div>
      <div class="bracket-slot-row${win === "away" ? " is-winner" : ""}">
        <span class="bracket-slot-dot" aria-hidden="true"></span>
        <div class="bracket-slot-main">${bracketTeamLineHtml(awayL, { winner: win === "away" })}</div>
        <span class="bracket-slot-goal">${ga}</span>
      </div>
      ${adminBlock}
    </div>`;
}

/**
 * Solo resultados reales confirmados por el admin; predicciones van en Partidos.
 * @param {string} participantId
 * @param {ReturnType<typeof loadPredictions>} [_predictions]
 */
function renderBrackets(participantId, _predictions) {
  void _predictions;
  const wrap = $("#brackets-wrap");
  wrap.innerHTML = "";

  const official = loadOfficialResults();
  void participantId;
  const offResolveMap = officialKnockoutScoresMapForResolution(official);
  const liveR32SlotMap = buildLiveR32SlotMap();
  let focus = localStorage.getItem(BRACKET_FOCUS_KEY) ?? "all";
  if (!["all", "r32", "r16", "qf", "sf", "tp", "final"].includes(focus)) focus = "all";

  const intro = document.createElement("p");
  intro.className = "bracket-legend muted";
  intro.innerHTML = "Vista de la llave final. Aqui puedes revisar como va cada cruce.";
  wrap.appendChild(intro);

  const pills = document.createElement("div");
  pills.className = "bracket-view-pills";
  const pillOpts = [
    ["all", "Todo el cuadro"],
    ["r32", "16vos"],
    ["r16", "8vos"],
    ["qf", "4tos"],
    ["sf", "Semis"],
    ["tp", "3.er puesto"],
    ["final", "Final"],
  ];
  for (const [val, label] of pillOpts) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `bracket-view-pill${focus === val ? " is-active" : ""}`;
    b.dataset.bracketFocus = val;
    b.textContent = label;
    b.addEventListener("click", () => {
      localStorage.setItem(BRACKET_FOCUS_KEY, val);
      refreshAll(loadSession());
    });
    pills.appendChild(b);
  }
  wrap.appendChild(pills);

  const scroll = document.createElement("div");
  scroll.className = "bracket-arena-scroll";
  const arena = document.createElement("div");
  arena.className = "bracket-arena";
  arena.dataset.bracketFocus = focus;

  const stage = document.createElement("div");
  stage.className = "bracket-stage";

  /** @param {"left"|"right"} side */
  function buildWing(side) {
    const wing = document.createElement("div");
    wing.className = `bracket-wing bracket-wing--${side}`;
    const cols =
      side === "left"
        ? [
            ["r32", "16vos", KNOCKOUT_PHASE_ROUND_INDEX.r32],
            ["r16", "8vos", KNOCKOUT_PHASE_ROUND_INDEX.r16],
            ["qf", "4tos", KNOCKOUT_PHASE_ROUND_INDEX.qf],
            ["sf", "Semis", KNOCKOUT_PHASE_ROUND_INDEX.sf],
          ]
        : [
            ["sf", "Semis", KNOCKOUT_PHASE_ROUND_INDEX.sf],
            ["qf", "4tos", KNOCKOUT_PHASE_ROUND_INDEX.qf],
            ["r16", "8vos", KNOCKOUT_PHASE_ROUND_INDEX.r16],
            ["r32", "16vos", KNOCKOUT_PHASE_ROUND_INDEX.r32],
          ];
    for (const [phase, label, ridx] of cols) {
      const col = document.createElement("div");
      col.className = "bracket-column";
      col.dataset.phase = phase;
      const pill = document.createElement("div");
      pill.className = "bracket-col-pill";
      pill.textContent = label;
      col.appendChild(pill);
      const body = document.createElement("div");
      body.className = "bracket-col-body";
      const indices = BRACKET_SIDE_MATCH_INDICES[side][/** @type {"r32"|"r16"|"qf"|"sf"} */ (phase)];
      for (const mi of indices) {
        body.insertAdjacentHTML(
          "beforeend",
          bracketPairBlockHtml(official, ridx, mi, false, offResolveMap, liveR32SlotMap),
        );
      }
      col.appendChild(body);
      wing.appendChild(col);
    }
    return wing;
  }

  stage.appendChild(buildWing("left"));

  const hub = document.createElement("div");
  hub.className = "bracket-hub";
  const hubInner = document.createElement("div");
  hubInner.className = "bracket-hub-inner";

  const finRi = KNOCKOUT_PHASE_ROUND_INDEX.final;
  const tpRi = KNOCKOUT_PHASE_ROUND_INDEX.tp;

  const hubFin = document.createElement("div");
  hubFin.className = "bracket-hub-block bracket-hub-block--final";
  hubFin.innerHTML = `<div class="bracket-hub-title">Final</div>${bracketPairBlockHtml(official, finRi, 0, false, offResolveMap, liveR32SlotMap)}`;

  const hubTp = document.createElement("div");
  hubTp.className = "bracket-hub-block bracket-hub-block--tp";
  hubTp.innerHTML = `<div class="bracket-hub-title">3.er y 4.º puesto</div>${bracketPairBlockHtml(official, tpRi, 0, false, offResolveMap, liveR32SlotMap)}`;

  hubInner.appendChild(hubFin);
  hubInner.appendChild(hubTp);
  hub.appendChild(hubInner);
  stage.appendChild(hub);

  stage.appendChild(buildWing("right"));

  arena.appendChild(stage);
  scroll.appendChild(arena);
  wrap.appendChild(scroll);
}

function computeLiveParticipantRows(currentParticipantId) {
  const offScores = getOfficialConfirmedGroupScores();
  const officialStore = loadOfficialResults();
  const liveOfficial = getLiveOfficialGroupSnapshot();
  const officialGen = officialStore.generalOfficial ?? {};
  const hasGeneralOfficial =
    officialStore.generalOfficialConfirmed === true &&
    Boolean(String(officialGen.first ?? "").trim()) &&
    Boolean(String(officialGen.second ?? "").trim()) &&
    Boolean(String(officialGen.third ?? "").trim());

  return getParticipants().map((p) => {
    let total = 0;
    let exact = 0;
    let outcome = 0;
    let zeroPointMatches = 0;
    let matchBonusCount = 0;
    let countedMatches = 0;
    let groupOrderBienCount = 0;
    let groupOrderPerfectCount = 0;
    let groupOrderBonusCount = 0;
    let generalBienCount = 0;
    let generalExcelenteCount = 0;
    let generalPerfectCount = 0;
    const pStore = loadPredictions(p.id);
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
      const officialThird = liveOfficial.thirdAdvanceByGroup?.[grp.id];
      const officialThirdDefined = officialThird === true || officialThird === false;
      const order = pStore.groupOrder?.[grp.id];
      const predOrder =
        Array.isArray(order) && order.length >= 4
          ? [0, 1, 2, 3].map((i) => (typeof order[i] === "string" ? order[i] : ""))
          : ["", "", "", ""];
      const predThird = pStore.groupThirdAdvances?.[grp.id];
      const top2InExactOrder =
        Boolean(predOrder[0]) &&
        Boolean(predOrder[1]) &&
        predOrder[0] === officialOrder[0] &&
        predOrder[1] === officialOrder[1];
      const fullOrderHit = [0, 1, 2, 3].every(
        (i) => Boolean(predOrder[i]) && Boolean(officialOrder[i]) && predOrder[i] === officialOrder[i],
      );
      if (fullOrderHit) groupOrderPerfectCount += 1;
      else if (top2InExactOrder) groupOrderBienCount += 1;

      const voteCountsByPos = getGroupOrderVoteCountsByPosition(grp.id);
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
      const off = offScores[m.id];
      if (!off) continue;
      if (pStore.groupScoresConfirmed?.[m.id] !== true) continue;
      const pred = pStore.groupScores[m.id] ?? { home: "", away: "" };
      const improb = getImprobableOutcomeSignForMatch(m.id, off);
      const matchScoring = getMatchScoringForQuiniela(m);
      const pts = computeGroupMatchPoints(off, pred, improb, matchScoring);
      if (pts === null) continue;
      total += pts;
      countedMatches += 1;
      if (pts === 0) zeroPointMatches += 1;
      if (isExactGroupPrediction(off, pred)) exact += 1;
      const breakdown = computeGroupMatchPointsBreakdown(off, pred, improb, matchScoring);
      if ((breakdown?.improbablePts ?? 0) > 0) matchBonusCount += 1;
      const oh = parseInt(String(off.home), 10);
      const oa = parseInt(String(off.away), 10);
      const ph = parseInt(String(pred.home), 10);
      const pa = parseInt(String(pred.away), 10);
      if (
        Number.isFinite(oh) &&
        Number.isFinite(oa) &&
        Number.isFinite(ph) &&
        Number.isFinite(pa)
      ) {
        const offSign = oh > oa ? "h" : oh < oa ? "a" : "d";
        const predSign = ph > pa ? "h" : ph < pa ? "a" : "d";
        if (offSign === predSign) outcome += 1;
      }
    }
    for (const m of getKnockoutMatchesFlat()) {
      if (officialStore.knockoutScoresConfirmed?.[m.id] !== true) continue;
      const off = officialStore.knockoutScores[m.id];
      if (!off || off.home === "" || off.away === "") continue;
      if (pStore.knockoutScoresConfirmed?.[m.id] !== true) continue;
      const pred = pStore.knockoutScores?.[m.id] ?? { home: "", away: "" };
      const improb = getImprobableOutcomeSignForKoMatch(m.id, off);
      const matchScoring = getMatchScoringForQuiniela(m);
      const pts = computeGroupMatchPoints(off, pred, improb, matchScoring);
      if (pts === null) continue;
      total += pts;
      countedMatches += 1;
      if (pts === 0) zeroPointMatches += 1;
      if (isExactGroupPrediction(off, pred)) exact += 1;
      const breakdown = computeGroupMatchPointsBreakdown(off, pred, improb, matchScoring);
      if ((breakdown?.improbablePts ?? 0) > 0) matchBonusCount += 1;
      const oh = parseInt(String(off.home), 10);
      const oa = parseInt(String(off.away), 10);
      const ph = parseInt(String(pred.home), 10);
      const pa = parseInt(String(pred.away), 10);
      if (
        Number.isFinite(oh) &&
        Number.isFinite(oa) &&
        Number.isFinite(ph) &&
        Number.isFinite(pa)
      ) {
        const offSign = oh > oa ? "h" : oh < oa ? "a" : "d";
        const predSign = ph > pa ? "h" : ph < pa ? "a" : "d";
        if (offSign === predSign) outcome += 1;
      }
    }
    const totalBonus = matchBonusCount + groupOrderBonusCount;
    const totalPerfect = exact + groupOrderPerfectCount + generalPerfectCount;
    const totalBien = groupOrderBienCount + generalBienCount;
    const totalExcelente = generalExcelenteCount;
    const avgPtsPerMatch = countedMatches > 0 ? total / countedMatches : 0;
    return {
      p,
      pts: total,
      exact,
      outcome,
      self: p.id === currentParticipantId,
      zeroPointMatches,
      matchBonusCount,
      countedMatches,
      avgPtsPerMatch,
      totalBonus,
      totalPerfect,
      totalBien,
      totalExcelente,
    };
  });
}

function renderFloatingRanking(session) {
  const host = $("#floating-ranking");
  const body = $("#floating-ranking-body");
  if (!host || !body) return;
  const currentId = session?.participantId ?? "";
  const rows = computeLiveParticipantRows(currentId).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.totalPerfect !== a.totalPerfect) return b.totalPerfect - a.totalPerfect;
    if (b.totalBonus !== a.totalBonus) return b.totalBonus - a.totalBonus;
    return a.p.name.localeCompare(b.p.name);
  });

  body.innerHTML = `<table class="floating-ranking-table" aria-label="Ranking en vivo">
    <thead><tr><th>#</th><th>Jugador</th><th>Pts</th></tr></thead>
    <tbody>
      ${rows
        .map((r, i) => {
          const rowClass = r.self ? "floating-ranking-row-self" : "";
          const you = r.self ? " (tu)" : "";
          return `<tr class="${rowClass}"><td>${i + 1}</td><th scope="row">${escapeHtml(r.p.name)}${you}</th><td><strong>${r.pts}</strong></td></tr>`;
        })
        .join("")}
    </tbody>
  </table>`;
}

function initFloatingRanking() {
  if (floatingRankingReady) return;
  floatingRankingReady = true;

  const host = $("#floating-ranking");
  const toggle = $("#floating-ranking-toggle");
  const card = $("#floating-ranking-card");
  const closeBtn = $("#floating-ranking-close");
  const enableBtn = $("#btn-toggle-floating-ranking");
  if (!host || !toggle || !card || !closeBtn) return;

  let enabled = localStorage.getItem(FLOATING_RANK_ENABLED_KEY) !== "0";

  const savedPosRaw = localStorage.getItem(FLOATING_RANK_POS_KEY);
  if (savedPosRaw) {
    try {
      const savedPos = JSON.parse(savedPosRaw);
      if (Number.isFinite(savedPos?.x) && Number.isFinite(savedPos?.y)) {
        host.style.left = `${savedPos.x}px`;
        host.style.top = `${savedPos.y}px`;
        host.style.right = "auto";
        host.style.bottom = "auto";
      }
    } catch {
      /* ignore invalid saved position */
    }
  }

  function updateEnableButton() {
    if (!enableBtn) return;
    enableBtn.textContent = `Ranking flotante: ${enabled ? "ON" : "OFF"}`;
  }

  function updateCardPlacement() {
    const gap = 8;
    host.classList.remove("open-up", "align-right");
    if (card.hidden) return;
    const hostRect = host.getBoundingClientRect();
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const openUp = hostRect.bottom + gap + cardHeight > window.innerHeight;
    const alignRight = hostRect.left + cardWidth > window.innerWidth;
    if (openUp) host.classList.add("open-up");
    if (alignRight) host.classList.add("align-right");
  }

  function setEnabled(next, persist = true) {
    enabled = next;
    host.hidden = !enabled;
    if (!enabled) {
      card.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
    updateEnableButton();
    if (persist) localStorage.setItem(FLOATING_RANK_ENABLED_KEY, enabled ? "1" : "0");
  }

  function setOpen(next) {
    if (!enabled) return;
    card.hidden = !next;
    toggle.setAttribute("aria-expanded", next ? "true" : "false");
    if (next) updateCardPlacement();
  }

  closeBtn.addEventListener("click", () => setOpen(false));
  if (enableBtn) {
    enableBtn.addEventListener("click", () => setEnabled(!enabled));
  }
  document.addEventListener("click", (e) => {
    if (card.hidden) return;
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (host.contains(t)) return;
    setOpen(false);
  });
  window.addEventListener("resize", () => updateCardPlacement());

  /** Seguimiento suavizado al arrastrar (simula ligero retraso respecto al puntero). */
  const dragSmooth = {
    pointerId: -1,
    originClientX: 0,
    originClientY: 0,
    originHostLeft: 0,
    originHostTop: 0,
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
    moved: false,
    rafId: 0,
    /** Más bajo = más retraso al seguir el puntero (~0.1 = bastante "flota") */
    lerp: 0.1,
  };

  function clampHostPos(x, y) {
    const maxX = Math.max(0, window.innerWidth - host.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - host.offsetHeight);
    return {
      x: Math.min(maxX, Math.max(0, x)),
      y: Math.min(maxY, Math.max(0, y)),
    };
  }

  function applyHostPosPx(x, y) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    host.style.left = `${rx}px`;
    host.style.top = `${ry}px`;
    host.style.right = "auto";
    host.style.bottom = "auto";
    updateCardPlacement();
  }

  function stopDragRaf() {
    if (dragSmooth.rafId) {
      cancelAnimationFrame(dragSmooth.rafId);
      dragSmooth.rafId = 0;
    }
  }

  function dragRafTick() {
    const dx = dragSmooth.targetX - dragSmooth.currentX;
    const dy = dragSmooth.targetY - dragSmooth.currentY;
    if (Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35) {
      dragSmooth.currentX = dragSmooth.targetX;
      dragSmooth.currentY = dragSmooth.targetY;
      applyHostPosPx(dragSmooth.currentX, dragSmooth.currentY);
      dragSmooth.rafId = 0;
      return;
    }
    dragSmooth.currentX += dx * dragSmooth.lerp;
    dragSmooth.currentY += dy * dragSmooth.lerp;
    applyHostPosPx(dragSmooth.currentX, dragSmooth.currentY);
    dragSmooth.rafId = requestAnimationFrame(dragRafTick);
  }

  function scheduleDragRaf() {
    if (!dragSmooth.rafId) dragSmooth.rafId = requestAnimationFrame(dragRafTick);
  }

  toggle.addEventListener("pointerdown", (e) => {
    dragSmooth.pointerId = e.pointerId;
    dragSmooth.moved = false;
    stopDragRaf();
    const rect = host.getBoundingClientRect();
    dragSmooth.originClientX = e.clientX;
    dragSmooth.originClientY = e.clientY;
    dragSmooth.originHostLeft = rect.left;
    dragSmooth.originHostTop = rect.top;
    dragSmooth.currentX = dragSmooth.targetX = rect.left;
    dragSmooth.currentY = dragSmooth.targetY = rect.top;
    toggle.setPointerCapture(e.pointerId);
    host.classList.add("floating-ranking--pressing");
  });

  toggle.addEventListener("pointermove", (e) => {
    if (dragSmooth.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragSmooth.originClientX;
    const dy = e.clientY - dragSmooth.originClientY;
    if (!dragSmooth.moved && Math.hypot(dx, dy) > 6) {
      dragSmooth.moved = true;
      host.classList.remove("floating-ranking--pressing");
      host.classList.add("is-dragging");
    }
    if (!dragSmooth.moved) return;

    const rawX = dragSmooth.originHostLeft + (e.clientX - dragSmooth.originClientX);
    const rawY = dragSmooth.originHostTop + (e.clientY - dragSmooth.originClientY);
    const p = clampHostPos(rawX, rawY);
    dragSmooth.targetX = p.x;
    dragSmooth.targetY = p.y;
    scheduleDragRaf();
  });

  toggle.addEventListener("pointerup", (e) => {
    if (dragSmooth.pointerId !== e.pointerId) return;
    stopDragRaf();
    host.classList.remove("is-dragging", "floating-ranking--pressing");
    if (dragSmooth.moved) {
      const p = clampHostPos(dragSmooth.targetX, dragSmooth.targetY);
      dragSmooth.currentX = dragSmooth.targetX = p.x;
      dragSmooth.currentY = dragSmooth.targetY = p.y;
      applyHostPosPx(p.x, p.y);
      localStorage.setItem(FLOATING_RANK_POS_KEY, JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) }));
    } else {
      setOpen(card.hidden);
    }
    dragSmooth.pointerId = -1;
  });

  toggle.addEventListener("pointercancel", () => {
    stopDragRaf();
    host.classList.remove("is-dragging", "floating-ranking--pressing");
    dragSmooth.pointerId = -1;
  });

  setEnabled(enabled, false);
}

function renderFinalRanking(session) {
  const intro = $("#final-ranking-intro");
  const body = $("#table-final-ranking-body");
  if (!intro || !body) return;
  if (!session) {
    intro.textContent = "Entra con tu participante para ver el ranking final.";
    body.innerHTML = "";
    return;
  }
  intro.textContent = "Aqui ves la suma total de puntos de cada participante.";
  const rows = computeLiveParticipantRows(session.participantId).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.totalPerfect !== a.totalPerfect) return b.totalPerfect - a.totalPerfect;
    if (b.totalBonus !== a.totalBonus) return b.totalBonus - a.totalBonus;
    return a.p.name.localeCompare(b.p.name);
  });
  const maxBonus = Math.max(0, ...rows.map((r) => r.totalBonus));
  const maxPerfect = Math.max(0, ...rows.map((r) => r.totalPerfect));
  const maxBien = Math.max(0, ...rows.map((r) => r.totalBien));
  const maxExcelente = Math.max(0, ...rows.map((r) => r.totalExcelente));
  const maxPts = Math.max(0, ...rows.map((r) => r.pts));
  body.innerHTML = rows
    .map((r, i) => {
      const rowCls = r.self ? "row-self" : "";
      const you = r.self ? ' <span class="td-muted">(tú)</span>' : "";
      const bonusCls = maxBonus > 0 && r.totalBonus === maxBonus ? "group-ranking-cell--top" : "";
      const perfectCls = maxPerfect > 0 && r.totalPerfect === maxPerfect ? "group-ranking-cell--top" : "";
      const bienCls = maxBien > 0 && r.totalBien === maxBien ? "group-ranking-cell--top" : "";
      const excCls = maxExcelente > 0 && r.totalExcelente === maxExcelente ? "group-ranking-cell--top" : "";
      const ptsCls = maxPts > 0 && r.pts === maxPts ? "group-ranking-cell--top" : "";
      return `<tr class="${rowCls}">
        <td>${i + 1}</td>
        <th scope="row">${escapeHtml(r.p.name)}${you}</th>
        <td class="${bonusCls}">${r.totalBonus}</td>
        <td class="${perfectCls}">${r.totalPerfect}</td>
        <td class="${bienCls}">${r.totalBien}</td>
        <td class="${excCls}">${r.totalExcelente}</td>
        <td class="${ptsCls}"><strong>${r.pts}</strong></td>
      </tr>`;
    })
    .join("");
}

function renderStats(session) {
  const intro = $("#stats-intro");
  const lbBody = $("#table-leaderboard-body");
  const acBody = $("#table-aciertos-body");
  const podium = $("#stats-podium");

  if (!session || !podium) {
    intro.textContent = "Entra con tu participante para ver las estadisticas.";
    lbBody.innerHTML = "";
    acBody.innerHTML = "";
    if (podium) podium.innerHTML = "";
    return;
  }

  intro.textContent = "Resumen general de rendimiento y aciertos de todos.";

  const rows = computeLiveParticipantRows(session.participantId);
  const byPoints = [...rows].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.totalPerfect !== a.totalPerfect) return b.totalPerfect - a.totalPerfect;
    return a.p.name.localeCompare(b.p.name);
  });

  const top3 = byPoints.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const podiumOrder = [1, 0, 2].filter((i) => top3[i]);
  podium.innerHTML = `<div class="stats-podium-grid">${podiumOrder
    .map((idx) => {
      const r = top3[idx];
      const pos = idx + 1;
      const you = r.self ? ' <span class="td-muted">(tú)</span>' : "";
      return `<div class="stats-podium-slot stats-podium-slot--p${pos}">
        <article class="stats-podium-card stats-podium-card--p${pos}">
          <div class="stats-podium-medal">${medals[idx]}</div>
          <h3 class="stats-podium-name">${escapeHtml(r.p.name)}${you}</h3>
          <p class="stats-podium-points">${r.pts} pts</p>
        </article>
        <div class="stats-podium-pillar stats-podium-pillar--p${pos}">
          <span class="stats-podium-place">${pos}</span>
        </div>
      </div>`;
    })
    .join("")}</div>`;

  lbBody.innerHTML = byPoints
    .slice(3)
    .map((r, i) => {
      const highlight = r.self ? " row-self" : "";
      return `<tr class="${highlight.trim()}"><td>${i + 4}</td><td>${escapeHtml(r.p.name)}</td><td>${r.pts}</td></tr>`;
    })
    .join("");

  acBody.innerHTML = rows
    .map((r) => {
      const self = r.self ? " (tú)" : "";
      return `<tr>
        <td>${escapeHtml(r.p.name)}${self}</td>
        <td>${r.zeroPointMatches}</td>
        <td>${r.exact}</td>
        <td>${r.outcome}</td>
        <td>${r.matchBonusCount}</td>
        <td>${r.avgPtsPerMatch.toFixed(2)}</td>
      </tr>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function teamLabelHtml(teamName) {
  const isTbd = isPlaceholderTeam(teamName);
  const cls = `team-label${isTbd ? " is-tbd" : ""}`;
  return `
    <span class="${cls}">
      ${getTeamFlagImgHtml(teamName)}
      <span class="team-text">${escapeHtml(teamName)}</span>
    </span>
  `;
}

function pointsBadgeHtml(points, options = {}) {
  const { bonus = false, title = "" } = options;
  if (!points || points <= 0) return "";
  const cls = bonus
    ? "group-preds-pt-badge group-preds-pt-badge--bonus"
    : "group-preds-pt-badge";
  const safeTitle = title ? ` title="${escapeHtml(title)}"` : "";
  return `<span class="${cls}"${safeTitle}>+${points}</span>`;
}

function quinielaCellWithBadges(innerHtml, badgesHtml) {
  if (!badgesHtml) return innerHtml;
  return `<div class="quiniela-cell-badges-wrap"><div class="quiniela-cell-badges-main">${innerHtml}</div>${badgesHtml}</div>`;
}

function quinielaGanadorPickLabel(m, pred) {
  const s = predictionOutcomeSign(pred);
  if (!s) return '<span class="muted">—</span>';
  if (s === "h") return `<span class="quiniela-ganador-name">${escapeHtml(m.home)}</span>`;
  if (s === "a") return `<span class="quiniela-ganador-name">${escapeHtml(m.away)}</span>`;
  return '<span class="quiniela-ganador-draw">Empate</span>';
}

/**
 * Filas HTML del tbody de predicciones de un partido (quiniela).
 * @param {typeof GROUP_MATCHES[number]} m
 * @param {{ participantId: string }} session
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {boolean} isAdmin
 */
function buildQuinielaPredRowsHtml(m, session, official, isAdmin) {
  const matchScoring = getMatchScoringForQuiniela(m);
  const off = official.groupScores[m.id] ?? { home: "", away: "" };
  const matchStage = official.groupMatchState?.[m.id] ?? "ready";
  const officialConfirmed = matchStage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
  const bothFilled = off.home !== "" && off.away !== "";
  const officialCompleteForScoring = bothFilled && (matchStage === "started" || officialConfirmed);
  const predictionsLocked = matchStage !== "ready" || official.groupPredictionsBlockedForAll === true;

  const preliminary = [...getParticipants()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const pStore = loadPredictions(p.id);
      const pred = pStore.groupScores[m.id] ?? { home: "", away: "" };
      const predCommitted = pStore.groupScoresConfirmed?.[m.id] === true;
      return { p, pred, predCommitted };
    });

  const improbableSign = officialCompleteForScoring ? getImprobableOutcomeSignForMatch(m.id, off) : null;

  const rows = preliminary.map((r) => {
    const pts =
      officialCompleteForScoring && r.predCommitted
        ? computeGroupMatchPoints(off, r.pred, improbableSign, matchScoring)
        : null;
    const breakdown =
      officialCompleteForScoring && r.predCommitted
        ? computeGroupMatchPointsBreakdown(off, r.pred, improbableSign, matchScoring)
        : null;
    const exact =
      officialCompleteForScoring &&
      r.predCommitted &&
      r.pred.home !== "" &&
      r.pred.away !== "" &&
      isExactGroupPrediction(off, r.pred);
    return { ...r, pts, breakdown, exact };
  });

  return rows
    .map((d) => {
      let cls = "quiniela-pred-row";
      if (d.p.id === session.participantId) cls += " quiniela-pred-row--self";

      const isSelf = d.p.id === session.participantId;
      const selfCanEdit = isSelf && !predictionsLocked && !d.predCommitted;
      /** Borrador no confirmado: otros no ven marcador ni ganador hasta «Confirmar». */
      const hideDraftScoresFromOthers = !isSelf && !d.predCommitted;
      const scoreCellPlain = (side) => {
        const v = side === "home" ? d.pred.home : d.pred.away;
        return v === "" ? "—" : escapeHtml(String(v));
      };

      let ph;
      let pa;
      if (isSelf) {
        if (d.predCommitted || predictionsLocked) {
          ph = scoreCellPlain("home");
          pa = scoreCellPlain("away");
        } else {
          ph = scoreStepperHtml(m.id, "home", d.pred.home, {
            extraClass: "quiniela-official-stepper",
          });
          pa = scoreStepperHtml(m.id, "away", d.pred.away, {
            extraClass: "quiniela-official-stepper",
          });
        }
      } else {
        ph = hideDraftScoresFromOthers ? "—" : scoreCellPlain("home");
        pa = hideDraftScoresFromOthers ? "—" : scoreCellPlain("away");
      }
      const homeBadge =
        d.breakdown && d.breakdown.homeGoalsPts > 0
          ? pointsBadgeHtml(d.breakdown.homeGoalsPts, { title: "Goles del local acertados" })
          : "";
      const awayBadge =
        d.breakdown && d.breakdown.awayGoalsPts > 0
          ? pointsBadgeHtml(d.breakdown.awayGoalsPts, { title: "Goles del visitante acertados" })
          : "";
      const homeHit = Boolean(officialCompleteForScoring && d.breakdown && d.breakdown.homeGoalsPts > 0);
      const awayHit = Boolean(officialCompleteForScoring && d.breakdown && d.breakdown.awayGoalsPts > 0);
      const ganadorHit = Boolean(officialCompleteForScoring && d.breakdown && d.breakdown.outcomePts > 0);

      let ganadorBadges = "";
      if (d.breakdown && officialCompleteForScoring && d.predCommitted) {
        const o = d.breakdown.outcomePts;
        const imp = d.breakdown.improbablePts;
        if (imp > 0 && o > 0) {
          ganadorBadges = pointsBadgeHtml(o + imp, {
            bonus: true,
            title: "Resultado acertado y bono resultado improbable (minoría acertada; el valor del botón es la suma de ambos)",
          });
        } else if (o > 0) {
          ganadorBadges = pointsBadgeHtml(o, { title: "Resultado acertado (ganador o empate)" });
        } else if (imp > 0) {
          ganadorBadges = pointsBadgeHtml(imp, {
            bonus: true,
            title: "Bono resultado improbable (minoría acertada)",
          });
        }
      }
      const ganadorInner = hideDraftScoresFromOthers
        ? '<span class="muted">—</span>'
        : quinielaGanadorPickLabel(m, d.pred);
      const ganadorCellInner =
        ganadorBadges !== ""
          ? `<div class="quiniela-cell-badges-wrap quiniela-cell-badges-wrap--ganador"><div class="quiniela-cell-badges-main"><span class="quiniela-ganador-pick">${ganadorInner}</span></div>${ganadorBadges}</div>`
          : `<div class="quiniela-cell-badges-wrap quiniela-cell-badges-wrap--ganador"><div class="quiniela-cell-badges-main"><span class="quiniela-ganador-pick">${ganadorInner}</span></div></div>`;

      const pcRaw = !officialCompleteForScoring ? "—" : d.pts === null ? "—" : String(d.pts);
      let perfectExtra = "";
      if (officialCompleteForScoring && d.predCommitted && d.exact) {
        const ex = d.breakdown?.exactPts ?? 0;
        const exactBadge = ex > 0 ? pointsBadgeHtml(ex, { title: "Puntos por marcador exacto" }) : "";
        perfectExtra = `<div class="quiniela-perfect-inline" role="status" aria-label="Marcador exacto"><span class="quiniela-perfect-label">Perfecto</span>${exactBadge}</div>`;
      }
      const phCell = quinielaCellWithBadges(ph, homeBadge);
      const paCell = quinielaCellWithBadges(pa, awayBadge);
      const pcCell = escapeHtml(pcRaw);
      const selfNote = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      const editableClass = selfCanEdit ? " quiniela-self-edit" : "";
      let actionsTd = '<td class="quiniela-pred-actions"></td>';
      if (isSelf) {
        const bothPred = d.pred.home !== "" && d.pred.away !== "";
        if (predictionsLocked) {
          actionsTd = '<td class="quiniela-pred-actions"><span class="muted">Bloqueado</span></td>';
        } else if (d.predCommitted) {
          actionsTd = `<td class="quiniela-pred-actions"><button type="button" class="btn btn-sm quiniela-pred-unlock-user" data-mid="${escapeHtml(m.id)}">Cambiar</button></td>`;
        } else {
          actionsTd = `<td class="quiniela-pred-actions"><button type="button" class="btn btn-primary btn-sm quiniela-pred-confirm-user" data-mid="${escapeHtml(m.id)}" ${bothPred ? "" : "disabled"}>Confirmar</button></td>`;
        }
      }

      const homeTdCls = ["quiniela-num", homeHit ? "quiniela-cell--hit" : ""].filter(Boolean).join(" ");
      const awayTdCls = ["quiniela-num", awayHit ? "quiniela-cell--hit" : ""].filter(Boolean).join(" ");
      const ganadorTdCls = ["quiniela-num", "quiniela-ganador-col", ganadorHit ? "quiniela-cell--hit" : ""]
        .filter(Boolean)
        .join(" ");
      const ptsTdCls = ["quiniela-num", "quiniela-pts", d.exact ? "quiniela-pts--exact" : ""]
        .filter(Boolean)
        .join(" ");

      const selfMidAttr = selfCanEdit ? ` data-quiniela-self-mid="${escapeHtml(m.id)}"` : "";
      const participantTd = `<td><div class="quiniela-participant-cell"><div class="quiniela-participant-line">${escapeHtml(d.p.name)}${selfNote}</div>${perfectExtra}</div></td>`;
      return `<tr class="${cls}${editableClass}"${selfMidAttr}>${participantTd}<td class="${homeTdCls}">${phCell}</td><td class="${awayTdCls}">${paCell}</td><td class="${ganadorTdCls}">${ganadorCellInner}</td><td class="${ptsTdCls}">${pcCell}</td>${actionsTd}</tr>`;
    })
    .join("");
}

/**
 * @param {ReturnType<typeof getKnockoutMatchesFlat>[number]} m
 */
function buildQuinielaPredRowsHtmlKo(m, session, official, isAdmin) {
  void isAdmin;
  const matchScoring = getMatchScoringForQuiniela(m);
  const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
  const officialConfirmed = official.knockoutScoresConfirmed?.[m.id] === true;
  const bothFilled = off.home !== "" && off.away !== "";
  const officialCompleteForScoring = bothFilled && officialConfirmed;
  const predictionsLocked = officialConfirmed;

  const { ri, mi } = getKoRoundMatchIndex(m.id);
  const preliminary = [...getParticipants()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const pStore = loadPredictions(p.id);
      const pred = pStore.knockoutScores?.[m.id] ?? { home: "", away: "" };
      const predCommitted = pStore.knockoutScoresConfirmed?.[m.id] === true;
      const homeName = resolveKnockoutSlotLabel(ri, mi, "home", pStore.knockoutScores ?? {});
      const awayName = resolveKnockoutSlotLabel(ri, mi, "away", pStore.knockoutScores ?? {});
      const virtualM = { id: m.id, home: homeName, away: awayName };
      return { p, pred, predCommitted, virtualM };
    });

  const improbableSign = officialCompleteForScoring
    ? getImprobableOutcomeSignForKoMatch(m.id, off)
    : null;

  const rows = preliminary.map((r) => {
    const pts =
      officialCompleteForScoring && r.predCommitted
        ? computeGroupMatchPoints(off, r.pred, improbableSign, matchScoring)
        : null;
    const breakdown =
      officialCompleteForScoring && r.predCommitted
        ? computeGroupMatchPointsBreakdown(off, r.pred, improbableSign, matchScoring)
        : null;
    const exact =
      officialCompleteForScoring &&
      r.predCommitted &&
      r.pred.home !== "" &&
      r.pred.away !== "" &&
      isExactGroupPrediction(off, r.pred);
    return { ...r, pts, breakdown, exact };
  });

  return rows
    .map((d) => {
      let cls = "quiniela-pred-row partidos-ko-pred-row";
      if (d.p.id === session.participantId) cls += " quiniela-pred-row--self";

      const vm = d.virtualM;
      const isSelf = d.p.id === session.participantId;
      const selfCanEdit = isSelf && !predictionsLocked && !d.predCommitted;
      const hideDraftScoresFromOthers = !isSelf && !d.predCommitted;
      const scoreCellPlain = (side) => {
        const v = side === "home" ? d.pred.home : d.pred.away;
        return v === "" ? "—" : escapeHtml(String(v));
      };

      let ph;
      let pa;
      if (isSelf) {
        if (d.predCommitted || predictionsLocked) {
          ph = scoreCellPlain("home");
          pa = scoreCellPlain("away");
        } else {
          ph = scoreStepperHtml(m.id, "home", d.pred.home, {
            extraClass: "quiniela-official-stepper",
            idAttr: "data-kid",
          });
          pa = scoreStepperHtml(m.id, "away", d.pred.away, {
            extraClass: "quiniela-official-stepper",
            idAttr: "data-kid",
          });
        }
      } else {
        ph = hideDraftScoresFromOthers ? "—" : scoreCellPlain("home");
        pa = hideDraftScoresFromOthers ? "—" : scoreCellPlain("away");
      }
      const homeBadge =
        d.breakdown && d.breakdown.homeGoalsPts > 0
          ? pointsBadgeHtml(d.breakdown.homeGoalsPts, { title: "Goles del local acertados" })
          : "";
      const awayBadge =
        d.breakdown && d.breakdown.awayGoalsPts > 0
          ? pointsBadgeHtml(d.breakdown.awayGoalsPts, { title: "Goles del visitante acertados" })
          : "";
      const homeHit = Boolean(officialCompleteForScoring && d.breakdown && d.breakdown.homeGoalsPts > 0);
      const awayHit = Boolean(officialCompleteForScoring && d.breakdown && d.breakdown.awayGoalsPts > 0);
      const ganadorHit = Boolean(officialCompleteForScoring && d.breakdown && d.breakdown.outcomePts > 0);

      let ganadorBadges = "";
      if (d.breakdown && officialCompleteForScoring && d.predCommitted) {
        const o = d.breakdown.outcomePts;
        const imp = d.breakdown.improbablePts;
        if (imp > 0 && o > 0) {
          ganadorBadges = pointsBadgeHtml(o + imp, {
            bonus: true,
            title: "Resultado acertado y bono resultado improbable (minoría acertada; el valor del botón es la suma de ambos)",
          });
        } else if (o > 0) {
          ganadorBadges = pointsBadgeHtml(o, { title: "Resultado acertado (ganador o empate)" });
        } else if (imp > 0) {
          ganadorBadges = pointsBadgeHtml(imp, {
            bonus: true,
            title: "Bono resultado improbable (minoría acertada)",
          });
        }
      }
      const ganadorInner = hideDraftScoresFromOthers
        ? '<span class="muted">—</span>'
        : quinielaGanadorPickLabel(vm, d.pred);
      const ganadorCellInner =
        ganadorBadges !== ""
          ? `<div class="quiniela-cell-badges-wrap quiniela-cell-badges-wrap--ganador"><div class="quiniela-cell-badges-main"><span class="quiniela-ganador-pick">${ganadorInner}</span></div>${ganadorBadges}</div>`
          : `<div class="quiniela-cell-badges-wrap quiniela-cell-badges-wrap--ganador"><div class="quiniela-cell-badges-main"><span class="quiniela-ganador-pick">${ganadorInner}</span></div></div>`;

      const pcRaw = !officialCompleteForScoring ? "—" : d.pts === null ? "—" : String(d.pts);
      let perfectExtra = "";
      if (officialCompleteForScoring && d.predCommitted && d.exact) {
        const ex = d.breakdown?.exactPts ?? 0;
        const exactBadge = ex > 0 ? pointsBadgeHtml(ex, { title: "Puntos por marcador exacto" }) : "";
        perfectExtra = `<div class="quiniela-perfect-inline" role="status" aria-label="Marcador exacto"><span class="quiniela-perfect-label">Perfecto</span>${exactBadge}</div>`;
      }
      const phCell = quinielaCellWithBadges(ph, homeBadge);
      const paCell = quinielaCellWithBadges(pa, awayBadge);
      const pcCell = escapeHtml(pcRaw);
      const selfNote = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      const editableClass = selfCanEdit ? " partidos-ko-self-edit" : "";
      let actionsTd = '<td class="quiniela-pred-actions"></td>';
      if (isSelf) {
        const bothPred = d.pred.home !== "" && d.pred.away !== "";
        if (predictionsLocked) {
          actionsTd = '<td class="quiniela-pred-actions"><span class="muted">Bloqueado</span></td>';
        } else if (d.predCommitted) {
          actionsTd = `<td class="quiniela-pred-actions"><button type="button" class="btn btn-sm partidos-ko-pred-unlock-user" data-kid="${escapeHtml(m.id)}">Cambiar</button></td>`;
        } else {
          actionsTd = `<td class="quiniela-pred-actions"><button type="button" class="btn btn-primary btn-sm partidos-ko-pred-confirm-user" data-kid="${escapeHtml(m.id)}" ${bothPred ? "" : "disabled"}>Confirmar</button></td>`;
        }
      }

      const homeTdCls = ["quiniela-num", homeHit ? "quiniela-cell--hit" : ""].filter(Boolean).join(" ");
      const awayTdCls = ["quiniela-num", awayHit ? "quiniela-cell--hit" : ""].filter(Boolean).join(" ");
      const ganadorTdCls = ["quiniela-num", "quiniela-ganador-col", ganadorHit ? "quiniela-cell--hit" : ""]
        .filter(Boolean)
        .join(" ");
      const ptsTdCls = ["quiniela-num", "quiniela-pts", d.exact ? "quiniela-pts--exact" : ""]
        .filter(Boolean)
        .join(" ");

      const selfKidAttr = selfCanEdit ? ` data-partidos-ko-self-kid="${escapeHtml(m.id)}"` : "";
      const participantTd = `<td><div class="quiniela-participant-cell"><div class="quiniela-participant-line">${escapeHtml(d.p.name)}${selfNote}</div>${perfectExtra}</div></td>`;
      return `<tr class="${cls}${editableClass}"${selfKidAttr}>${participantTd}<td class="${homeTdCls}">${phCell}</td><td class="${awayTdCls}">${paCell}</td><td class="${ganadorTdCls}">${ganadorCellInner}</td><td class="${ptsTdCls}">${pcCell}</td>${actionsTd}</tr>`;
    })
    .join("");
}

function knockoutPhaseTitle(roundId) {
  const t = {
    r32: "16vos de final",
    r16: "8vos de final",
    qf: "Cuartos de final",
    sf: "Semifinal",
    tp: "3.er y 4.º puesto",
    final: "Final",
  };
  return t[/** @type {keyof typeof t} */ (roundId)] ?? String(roundId);
}

/**
 * @param {ReturnType<typeof getKnockoutMatchesFlat>[number]} m
 */
function renderQuinielaMatchCardKo(m, session, official, isAdmin) {
  const { ri, mi } = getKoRoundMatchIndex(m.id);
  const labelScores = allFilledOfficialKnockoutScores(official);
  const homeLab = resolveKnockoutSlotLabel(ri, mi, "home", labelScores);
  const awayLab = resolveKnockoutSlotLabel(ri, mi, "away", labelScores);
  const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
  const offOk = official.knockoutScoresConfirmed?.[m.id] === true;
  const vh = off.home === "" ? "—" : escapeHtml(String(off.home));
  const va = off.away === "" ? "—" : escapeHtml(String(off.away));
  const body = buildQuinielaPredRowsHtmlKo(m, session, official, isAdmin);

  const myPred = loadPredictions(session.participantId).knockoutScores ?? {};
  const colHomeFull = escapeHtml(resolveKnockoutSlotLabel(ri, mi, "home", myPred));
  const colAwayFull = escapeHtml(resolveKnockoutSlotLabel(ri, mi, "away", myPred));
  const colHome =
    colHomeFull.length > 20 ? `${colHomeFull.slice(0, 18)}…` : colHomeFull;
  const colAway =
    colAwayFull.length > 20 ? `${colAwayFull.slice(0, 18)}…` : colAwayFull;

  const statusBanner = offOk
    ? `<p class="quiniela-match-status quiniela-match-status--done" role="status"><strong>Resultado oficial confirmado.</strong></p>`
    : off.home !== "" && off.away !== ""
      ? `<p class="quiniela-match-status quiniela-match-status--pending" role="status"><strong>Marcador cargado.</strong> Falta confirmación.</p>`
      : `<p class="quiniela-match-status quiniela-match-status--ready" role="status">Sin resultado oficial todavía. Puedes <strong>confirmar tu predicción</strong> cuando el marcador esté listo.</p>`;

  const officialMini = isAdmin
    ? `
      <div class="quiniela-official partidos-ko-official ${offOk ? "partidos-ko-official--locked" : "partidos-ko-official--editing"}" data-ko-mid="${escapeHtml(m.id)}">
        <div class="quiniela-official-head">
          Resultado oficial
          ${offOk ? '<span class="quiniela-badge-confirmed">Confirmado</span>' : '<span class="muted">Borrador</span>'}
        </div>
        <div class="quiniela-official-grid ${offOk ? "quiniela-official-grid--readonly" : "quiniela-official-grid--edit"}">
          <div class="quiniela-cell quiniela-cell--team">${bracketTeamLineHtml(homeLab)}</div>
          <div class="quiniela-cell quiniela-cell--score">${offOk ? vh : scoreStepperHtml(m.id, "home", off.home, { disabled: false, idAttr: "data-okid", extraClass: "quiniela-official-stepper" })}</div>
          <div class="quiniela-cell quiniela-cell--score">${offOk ? va : scoreStepperHtml(m.id, "away", off.away, { disabled: false, idAttr: "data-okid", extraClass: "quiniela-official-stepper" })}</div>
          <div class="quiniela-cell quiniela-cell--team">${bracketTeamLineHtml(awayLab)}</div>
        </div>
        <div class="quiniela-official-actions">
          ${
            offOk
              ? `<button type="button" class="btn btn-sm partidos-ko-btn-unconfirm" data-kid="${escapeHtml(m.id)}">Desconfirmar</button>`
              : `<button type="button" class="btn btn-primary btn-sm partidos-ko-btn-confirm" data-kid="${escapeHtml(m.id)}" ${(off.home !== "" && off.away !== "") ? "" : "disabled"}>Confirmar resultado</button>`
          }
        </div>
      </div>`
    : `
      <div class="quiniela-official">
        <div class="quiniela-official-head">Resultado oficial</div>
        <div class="quiniela-official-grid quiniela-official-grid--readonly">
          <div class="quiniela-cell quiniela-cell--team">${bracketTeamLineHtml(homeLab)}</div>
          <div class="quiniela-cell quiniela-cell--score">${vh}</div>
          <div class="quiniela-cell quiniela-cell--score">${va}</div>
          <div class="quiniela-cell quiniela-cell--team">${bracketTeamLineHtml(awayLab)}</div>
        </div>
      </div>`;

  return `
    <article class="card quiniela-match partidos-ko-card" data-ko-round="${escapeHtml(m.roundId)}" data-quiniela-mid="${escapeHtml(m.id)}">
      <h2 class="quiniela-match-title">${escapeHtml(knockoutPhaseTitle(m.roundId))} · ${bracketTeamLineHtml(homeLab)} <span class="vs">vs</span> ${bracketTeamLineHtml(awayLab)}</h2>
      ${statusBanner}
      ${officialMini}
      <div class="quiniela-preds-head">Predicciones</div>
      <div class="table-scroll quiniela-table-wrap">
        <table class="table table-compact quiniela-preds">
          <thead>
            <tr>
              <th>Participante</th>
              <th class="quiniela-num" title="${colHomeFull}">${colHome}</th>
              <th class="quiniela-num" title="${colAwayFull}">${colAway}</th>
              <th class="quiniela-num quiniela-ganador-col" scope="col">Ganador</th>
              <th class="quiniela-num">Pts</th>
              <th class="quiniela-actions-col" scope="col"><span class="visually-hidden">Acción</span></th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </article>`;
}

/**
 * Actualiza solo la tabla de predicciones de un partido (sin reemplazar el bloque oficial → no pierde foco en steppers).
 * @param {HTMLElement | null} wrap
 * @param {string} mid
 */
function patchQuinielaMatchPredRows(wrap, mid) {
  const session = loadSession();
  if (!wrap || !session) return;
  const m = GROUP_MATCHES.find((x) => x.id === mid);
  if (!m) return;
  const card = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(mid)}"]`);
  if (!card) return;
  const tb = card.querySelector(".quiniela-preds tbody");
  if (!tb) return;
  const isAdmin = canEditOfficialResults(session.participantId);
  tb.innerHTML = buildQuinielaPredRowsHtml(m, session, loadOfficialResults(), isAdmin);
  wireQuinielaPredictionHandlersInScope(card, session);
}

/**
 * @param {HTMLElement} scope
 * @param {{ participantId: string }} session
 */
function wireQuinielaPredictionHandlersInScope(scope, session) {
  scope.querySelectorAll(".quiniela-self-edit").forEach((row) => {
    wireScoreSteppers(row, "grupos", (partial) => {
      const mid = row.dataset.quinielaSelfMid;
      if (!mid || !partial[mid]) return;
      savePredictions(session.participantId, {
        groupScores: { [mid]: { home: partial[mid].home, away: partial[mid].away } },
      });
      redrawQuiniela();
      redrawTeamStats();
      renderStats(loadSession());
      renderGrupos(session.participantId, loadPredictions(session.participantId));
    });
  });

  scope.querySelectorAll(".quiniela-pred-confirm-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mid = btn.dataset.mid;
      if (!mid) return;
      const offNow = loadOfficialResults();
      if ((offNow.groupMatchState?.[mid] ?? "ready") !== "ready") return;
      const latest = loadPredictions(session.participantId);
      const sc = latest.groupScores[mid] ?? { home: "", away: "" };
      if (sc.home === "" || sc.away === "") return;
      savePredictions(session.participantId, { groupScoresConfirmed: { [mid]: true } });
      redrawQuiniela();
      redrawTeamStats();
      renderStats(loadSession());
      renderGrupos(session.participantId, loadPredictions(session.participantId));
    });
  });

  scope.querySelectorAll(".quiniela-pred-unlock-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mid = btn.dataset.mid;
      if (!mid) return;
      const offNow = loadOfficialResults();
      if ((offNow.groupMatchState?.[mid] ?? "ready") !== "ready") return;
      const latest = loadPredictions(session.participantId);
      const { [mid]: _r, ...rest } = latest.groupScoresConfirmed ?? {};
      savePredictions(session.participantId, {
        groupScoresConfirmed: rest,
        replaceGroupScoresConfirmed: true,
      });
      redrawQuiniela();
      redrawTeamStats();
      renderStats(loadSession());
      renderGrupos(session.participantId, loadPredictions(session.participantId));
    });
  });

  scope.querySelectorAll(".partidos-ko-self-edit").forEach((row) => {
    wireScoreSteppers(row, "knockout", (partial) => {
      const kid = row.dataset.partidosKoSelfKid;
      if (!kid || !partial[kid]) return;
      const latest = loadPredictions(session.participantId);
      savePredictions(session.participantId, {
        knockoutScores: {
          ...latest.knockoutScores,
          [kid]: { home: partial[kid].home, away: partial[kid].away },
        },
      });
      redrawQuiniela();
      renderStats(loadSession());
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".partidos-ko-pred-confirm-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kid;
      if (!kid) return;
      if (loadOfficialResults().knockoutScoresConfirmed?.[kid] === true) return;
      const latest = loadPredictions(session.participantId);
      const sc = latest.knockoutScores?.[kid] ?? { home: "", away: "" };
      if (sc.home === "" || sc.away === "") return;
      savePredictions(session.participantId, { knockoutScoresConfirmed: { [kid]: true } });
      redrawQuiniela();
      renderStats(loadSession());
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".partidos-ko-pred-unlock-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kid;
      if (!kid) return;
      if (loadOfficialResults().knockoutScoresConfirmed?.[kid] === true) return;
      const latest = loadPredictions(session.participantId);
      const { [kid]: _r, ...rest } = latest.knockoutScoresConfirmed ?? {};
      savePredictions(session.participantId, {
        knockoutScoresConfirmed: rest,
        replaceKnockoutScoresConfirmed: true,
      });
      redrawQuiniela();
      renderStats(loadSession());
      refreshAll(loadSession());
    });
  });
}

function redrawQuiniela() {
  renderQuiniela(loadSession(), loadOfficialResults());
}

function setMatchRankingGroupFilterVisible(visible) {
  const wrap = $("#match-ranking-group-wrap");
  if (!wrap) return;
  wrap.hidden = !visible;
}

function ensureMatchRankingFilters() {
  const scopeSel = $("#match-ranking-scope-filter");
  const groupSel = $("#match-ranking-group-filter");
  if (!scopeSel || !groupSel) return;

  if (scopeSel.dataset.ready !== "1") {
    scopeSel.innerHTML = `
      <option value="all">Todos los partidos</option>
      <option value="grupos">Fase de grupos</option>
      <option value="all-ko">Eliminatoria (todas)</option>
      <option value="r32">16vos</option>
      <option value="r16">8vos</option>
      <option value="qf">4tos</option>
      <option value="sf">Semifinales</option>
      <option value="tp">3.er y 4.º puesto</option>
      <option value="final">Final</option>
    `;
    scopeSel.addEventListener("change", () => {
      localStorage.setItem(MATCH_RANK_SCOPE_KEY, scopeSel.value);
      setMatchRankingGroupFilterVisible(scopeSel.value === "grupos");
      redrawMatchRanking();
    });
    scopeSel.dataset.ready = "1";
  }

  if (groupSel.dataset.ready !== "1") {
    groupSel.innerHTML = `<option value="">Todos los grupos</option>${GROUPS.map((g) => `<option value="${g.id}">Grupo ${g.id}</option>`).join("")}`;
    groupSel.addEventListener("change", () => {
      localStorage.setItem(MATCH_RANK_GROUP_KEY, groupSel.value);
      redrawMatchRanking();
    });
    groupSel.dataset.ready = "1";
  }

  const savedScope = localStorage.getItem(MATCH_RANK_SCOPE_KEY);
  if (savedScope && [...scopeSel.options].some((o) => o.value === savedScope)) {
    scopeSel.value = savedScope;
  } else {
    scopeSel.value = "all";
  }

  const savedGroup = localStorage.getItem(MATCH_RANK_GROUP_KEY);
  if (savedGroup != null && [...groupSel.options].some((o) => o.value === savedGroup)) {
    groupSel.value = savedGroup;
  } else {
    groupSel.value = "";
  }
  setMatchRankingGroupFilterVisible(scopeSel.value === "grupos");
}

function computeMatchRankingRows(scope, groupId, sessionParticipantId) {
  const official = loadOfficialResults();
  const allKo = getKnockoutMatchesFlat();
  let selectedGroupMatches = [];
  let selectedKoMatches = [];
  if (scope === "all") {
    selectedGroupMatches = GROUP_MATCHES;
    selectedKoMatches = allKo;
  } else if (scope === "grupos") {
    selectedGroupMatches = groupId ? GROUP_MATCHES.filter((m) => m.groupId === groupId) : GROUP_MATCHES;
  } else if (scope === "all-ko") {
    selectedKoMatches = allKo;
  } else {
    selectedKoMatches = allKo.filter((m) => m.roundId === scope);
  }

  /** @type {Record<string, ("h"|"d"|"a"|null)>} */
  const groupImprobableByMatch = {};
  for (const m of selectedGroupMatches) {
    const off = official.groupScores[m.id] ?? { home: "", away: "" };
    const stage = official.groupMatchState?.[m.id] ?? "ready";
    const officialConfirmed = stage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
    const bothFilled = off.home !== "" && off.away !== "";
    const officialCompleteForScoring = bothFilled && (stage === "started" || officialConfirmed);
    groupImprobableByMatch[m.id] = officialCompleteForScoring
      ? getImprobableOutcomeSignForMatch(m.id, off)
      : null;
  }

  /** @type {Record<string, ("h"|"d"|"a"|null)>} */
  const koImprobableByMatch = {};
  for (const m of selectedKoMatches) {
    const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
    const officialConfirmed = official.knockoutScoresConfirmed?.[m.id] === true;
    const bothFilled = off.home !== "" && off.away !== "";
    const officialCompleteForScoring = bothFilled && officialConfirmed;
    koImprobableByMatch[m.id] = officialCompleteForScoring
      ? getImprobableOutcomeSignForKoMatch(m.id, off)
      : null;
  }

  const rows = getParticipants().map((p) => {
    const pStore = loadPredictions(p.id);
    let perfectCount = 0;
    let bonusCount = 0;
    let totalPoints = 0;

    for (const m of selectedGroupMatches) {
      const off = official.groupScores[m.id] ?? { home: "", away: "" };
      const stage = official.groupMatchState?.[m.id] ?? "ready";
      const officialConfirmed = stage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
      const bothFilled = off.home !== "" && off.away !== "";
      const officialCompleteForScoring = bothFilled && (stage === "started" || officialConfirmed);
      if (!officialCompleteForScoring) continue;
      if (pStore.groupScoresConfirmed?.[m.id] !== true) continue;
      const pred = pStore.groupScores[m.id] ?? { home: "", away: "" };
      const scoring = getMatchScoringForQuiniela(m);
      const improbableSign = groupImprobableByMatch[m.id] ?? null;
      const pts = computeGroupMatchPoints(off, pred, improbableSign, scoring);
      const breakdown = computeGroupMatchPointsBreakdown(off, pred, improbableSign, scoring);
      const exact = isExactGroupPrediction(off, pred);
      if (pts != null) totalPoints += pts;
      if (exact) perfectCount += 1;
      if (breakdown?.improbablePts && breakdown.improbablePts > 0) bonusCount += 1;
    }

    for (const m of selectedKoMatches) {
      const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
      const officialConfirmed = official.knockoutScoresConfirmed?.[m.id] === true;
      const bothFilled = off.home !== "" && off.away !== "";
      const officialCompleteForScoring = bothFilled && officialConfirmed;
      if (!officialCompleteForScoring) continue;
      if (pStore.knockoutScoresConfirmed?.[m.id] !== true) continue;
      const pred = pStore.knockoutScores?.[m.id] ?? { home: "", away: "" };
      const scoring = getMatchScoringForQuiniela(m);
      const improbableSign = koImprobableByMatch[m.id] ?? null;
      const pts = computeGroupMatchPoints(off, pred, improbableSign, scoring);
      const breakdown = computeGroupMatchPointsBreakdown(off, pred, improbableSign, scoring);
      const exact = isExactGroupPrediction(off, pred);
      if (pts != null) totalPoints += pts;
      if (exact) perfectCount += 1;
      if (breakdown?.improbablePts && breakdown.improbablePts > 0) bonusCount += 1;
    }

    return { participant: p, perfectCount, bonusCount, totalPoints };
  });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.perfectCount !== a.perfectCount) return b.perfectCount - a.perfectCount;
    if (b.bonusCount !== a.bonusCount) return b.bonusCount - a.bonusCount;
    return a.participant.name.localeCompare(b.participant.name);
  });

  const maxPerfect = Math.max(0, ...rows.map((r) => r.perfectCount));
  const maxBonus = Math.max(0, ...rows.map((r) => r.bonusCount));
  const maxTotal = Math.max(0, ...rows.map((r) => r.totalPoints));

  return rows
    .map((r, idx) => {
      const isSelf = r.participant.id === sessionParticipantId;
      const rowCls = ["match-ranking-row", isSelf ? "row-self" : ""].filter(Boolean).join(" ");
      const perfectCls = maxPerfect > 0 && r.perfectCount === maxPerfect ? "group-ranking-cell--top" : "";
      const bonusCls = maxBonus > 0 && r.bonusCount === maxBonus ? "group-ranking-cell--top" : "";
      const totalCls = maxTotal > 0 && r.totalPoints === maxTotal ? "group-ranking-cell--top" : "";
      const you = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      return `<tr class="${rowCls}">
        <td class="group-ranking-rank">${idx + 1}</td>
        <th scope="row" class="group-ranking-name">${escapeHtml(r.participant.name)}${you}</th>
        <td class="group-ranking-num ${perfectCls}">${r.perfectCount}</td>
        <td class="group-ranking-num ${bonusCls}">${r.bonusCount}</td>
        <td class="group-ranking-num ${totalCls}"><strong>${r.totalPoints}</strong></td>
      </tr>`;
    })
    .join("");
}

function redrawMatchRanking() {
  const body = $("#table-match-ranking-body");
  const intro = $("#match-ranking-intro");
  const session = loadSession();
  if (!body || !intro) return;
  if (!session) {
    body.innerHTML = "";
    intro.textContent = "";
    return;
  }
  ensureMatchRankingFilters();
  const scopeSel = $("#match-ranking-scope-filter");
  const groupSel = $("#match-ranking-group-filter");
  const scope = scopeSel?.value ?? "all";
  const groupId = groupSel?.value ?? "";
  intro.textContent =
    scope === "grupos"
      ? groupId
        ? `Ranking de partidos en fase de grupos · Grupo ${groupId}.`
        : "Ranking de partidos en fase de grupos."
      : scope === "all"
        ? "Ranking de partidos de todo el torneo."
        : scope === "all-ko"
          ? "Ranking de partidos en eliminatoria."
          : `Ranking de partidos · ${knockoutPhaseTitle(scope)}.`;
  body.innerHTML = computeMatchRankingRows(scope, groupId, session.participantId);
}

function formatPredScoreCell(pred) {
  const h = pred?.home === "" || pred?.home == null ? "—" : escapeHtml(String(pred.home));
  const a = pred?.away === "" || pred?.away == null ? "—" : escapeHtml(String(pred.away));
  return `${h} - ${a}`;
}

function formatOfficialScoreCell(off, show) {
  if (!show) return '<span class="muted">—</span>';
  const h = off?.home === "" || off?.home == null ? "—" : escapeHtml(String(off.home));
  const a = off?.away === "" || off?.away == null ? "—" : escapeHtml(String(off.away));
  return `${h} - ${a}`;
}

function buildMatchHistory(participantId) {
  const official = loadOfficialResults();
  const pStore = loadPredictions(participantId);
  const rows = [];
  let total = 0;
  let totalPossible = 0;

  for (const m of GROUP_MATCHES) {
    const pred = pStore.groupScores?.[m.id] ?? { home: "", away: "" };
    const predConfirmed = pStore.groupScoresConfirmed?.[m.id] === true;
    const off = official.groupScores?.[m.id] ?? { home: "", away: "" };
    const stage = official.groupMatchState?.[m.id] ?? "ready";
    const officialConfirmed = stage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
    const bothFilled = off.home !== "" && off.away !== "";
    const officialComplete = bothFilled && (stage === "started" || officialConfirmed);
    const improbableSign = officialComplete ? getImprobableOutcomeSignForMatch(m.id, off) : null;
    const scoring = getMatchScoringForQuiniela(m);
    const pts =
      officialComplete && predConfirmed
        ? computeGroupMatchPoints(off, pred, improbableSign, scoring)
        : null;
    const breakdown =
      officialComplete && predConfirmed
        ? computeGroupMatchPointsBreakdown(off, pred, improbableSign, scoring)
        : null;
    if (pts != null) total += pts;
    if (officialComplete && predConfirmed) totalPossible += scoring.maxPerMatch;

    const stateTxt =
      pred.home === "" || pred.away === ""
        ? '<span class="muted">Sin llenar</span>'
        : predConfirmed
          ? '<span class="match-history-state match-history-state--ok">Confirmado</span>'
          : '<span class="match-history-state">No confirmado</span>';
    const ptsTxt =
      pts == null
        ? '<span class="muted">—</span>'
        : pts > scoring.maxPerMatch
          ? `<strong class="team-order-total-value team-order-total-value--rainbow">${pts}</strong>`
          : pts === scoring.maxPerMatch
            ? `<strong class="match-history-pts-max">${pts}</strong>`
            : breakdown?.improbablePts
              ? pointsBadgeHtml(pts, {
                  bonus: true,
                  title: "Incluye bono de resultado improbable",
                })
              : String(pts);

    rows.push(`<tr>
      <td>Grupo ${escapeHtml(m.groupId)}</td>
      <td>${teamLabelHtml(m.home)} <span class="vs">vs</span> ${teamLabelHtml(m.away)}</td>
      <td>${formatPredScoreCell(pred)}</td>
      <td>${stateTxt}</td>
      <td>${formatOfficialScoreCell(off, officialComplete)}</td>
      <td class="match-history-pts">${ptsTxt}</td>
    </tr>`);
  }

  for (const m of getKnockoutMatchesFlat()) {
    const pred = pStore.knockoutScores?.[m.id] ?? { home: "", away: "" };
    const predConfirmed = pStore.knockoutScoresConfirmed?.[m.id] === true;
    const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
    const officialConfirmed = official.knockoutScoresConfirmed?.[m.id] === true;
    const bothFilled = off.home !== "" && off.away !== "";
    const officialComplete = bothFilled && officialConfirmed;
    const improbableSign = officialComplete
      ? getImprobableOutcomeSignForKoMatch(m.id, off)
      : null;
    const scoring = getMatchScoringForQuiniela(m);
    const pts =
      officialComplete && predConfirmed
        ? computeGroupMatchPoints(off, pred, improbableSign, scoring)
        : null;
    const breakdown =
      officialComplete && predConfirmed
        ? computeGroupMatchPointsBreakdown(off, pred, improbableSign, scoring)
        : null;
    if (pts != null) total += pts;
    if (officialComplete && predConfirmed) totalPossible += scoring.maxPerMatch;

    const { ri, mi } = getKoRoundMatchIndex(m.id);
    const homeLab = resolveKnockoutSlotLabel(ri, mi, "home", pStore.knockoutScores ?? {});
    const awayLab = resolveKnockoutSlotLabel(ri, mi, "away", pStore.knockoutScores ?? {});
    const stateTxt =
      pred.home === "" || pred.away === ""
        ? '<span class="muted">Sin llenar</span>'
        : predConfirmed
          ? '<span class="match-history-state match-history-state--ok">Confirmado</span>'
          : '<span class="match-history-state">No confirmado</span>';
    const ptsTxt =
      pts == null
        ? '<span class="muted">—</span>'
        : pts > scoring.maxPerMatch
          ? `<strong class="team-order-total-value team-order-total-value--rainbow">${pts}</strong>`
          : pts === scoring.maxPerMatch
            ? `<strong class="match-history-pts-max">${pts}</strong>`
            : breakdown?.improbablePts
              ? pointsBadgeHtml(pts, {
                  bonus: true,
                  title: "Incluye bono de resultado improbable",
                })
              : String(pts);

    rows.push(`<tr>
      <td>${escapeHtml(knockoutPhaseTitle(m.roundId))}</td>
      <td>${bracketTeamLineHtml(homeLab)} <span class="vs">vs</span> ${bracketTeamLineHtml(awayLab)}</td>
      <td>${formatPredScoreCell(pred)}</td>
      <td>${stateTxt}</td>
      <td>${formatOfficialScoreCell(off, officialComplete)}</td>
      <td class="match-history-pts">${ptsTxt}</td>
    </tr>`);
  }

  return { rowsHtml: rows.join(""), total, totalPossible };
}

function redrawMatchHistory() {
  const intro = $("#match-history-intro");
  const body = $("#table-match-history-body");
  const totals = $("#match-history-totals");
  const session = loadSession();
  if (!intro || !body || !totals) return;
  if (!session) {
    intro.textContent = "";
    body.innerHTML = "";
    totals.textContent = "";
    return;
  }
  intro.textContent = "Historial de tus partidos y puntos en grupos y eliminatoria.";
  const hist = buildMatchHistory(session.participantId);
  body.innerHTML = hist.rowsHtml;
  let totalClass = "team-order-total-value";
  if (hist.totalPossible > 0 && hist.total > hist.totalPossible) {
    totalClass += " team-order-total-value--rainbow";
  } else if (hist.totalPossible > 0 && hist.total === hist.totalPossible) {
    totalClass += " team-order-total-value--gold";
  }
  totals.innerHTML = `Total puntos: <strong class="${totalClass}">${hist.total}</strong> · Total posible (sin bono): <strong>${hist.totalPossible}</strong>`;
}

function setPartidosGroupToolbarVisible(visible) {
  const row = $("#partidos-group-toolbar");
  if (!row) return;
  row.hidden = !visible;
  row.classList.toggle("partidos-group-toolbar--hidden", !visible);
  row.style.display = visible ? "" : "none";
}

function ensureQuinielaFilter() {
  const sel = $("#quiniela-group-filter");
  if (!sel || sel.dataset.ready === "1") return;
  sel.innerHTML = `<option value="">Todos los grupos</option>${GROUPS.map((g) => `<option value="${g.id}">Grupo ${g.id}</option>`).join("")}`;
  sel.addEventListener("change", () => redrawQuiniela());
  sel.dataset.ready = "1";
}

function ensurePartidosScopeFilter() {
  const sel = $("#partidos-scope-filter");
  if (!sel || sel.dataset.ready === "1") return;
  sel.innerHTML = `
    <option value="grupos">Fase de grupos</option>
    <option value="all-ko">Eliminatoria (todas)</option>
    <option value="r32">16vos</option>
    <option value="r16">8vos</option>
    <option value="qf">4tos</option>
    <option value="sf">Semifinales</option>
    <option value="tp">3.er y 4.º puesto</option>
    <option value="final">Final</option>
  `;
  sel.addEventListener("change", () => {
    localStorage.setItem(PARTIDOS_SCOPE_KEY, sel.value);
    setPartidosGroupToolbarVisible(sel.value === "grupos");
    redrawQuiniela();
  });
  sel.dataset.ready = "1";
  const saved = localStorage.getItem(PARTIDOS_SCOPE_KEY);
  if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
  setPartidosGroupToolbarVisible(sel.value === "grupos");
}

/**
 * Estado del partido en la quiniela (visible para todos).
 * @param {"ready"|"started"|"finished"} matchStage
 * @param {boolean} officialConfirmed
 */
function quinielaMatchStatusBanner(matchStage, officialConfirmed) {
  if (matchStage === "ready") {
    return `<p class="quiniela-match-status quiniela-match-status--ready" role="status"><strong>No ha comenzado.</strong> Aquí puedes editar y confirmar tu predicción.</p>`;
  }
  if (matchStage === "started") {
    return `<p class="quiniela-match-status quiniela-match-status--live" role="status"><strong>En juego.</strong> Las predicciones están cerradas; el marcador oficial lo actualiza el admin.</p>`;
  }
  if (matchStage === "finished" && officialConfirmed) {
    return `<p class="quiniela-match-status quiniela-match-status--done" role="status"><strong>Finalizado.</strong> El resultado oficial ya está confirmado.</p>`;
  }
  return `<p class="quiniela-match-status quiniela-match-status--pending" role="status"><strong>Estado final pendiente.</strong> Falta confirmar el resultado oficial.</p>`;
}

/**
 * @param {{ participantId: string } | null} session
 * @param {ReturnType<typeof loadOfficialResults>} official
 */
function renderQuinielaMatchCard(m, session, official, isAdmin) {
  const off = official.groupScores[m.id] ?? { home: "", away: "" };
  const matchStage = official.groupMatchState?.[m.id] ?? "ready";
  const officialConfirmed = matchStage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
  const bothFilled = off.home !== "" && off.away !== "";
  const showPublicScore = officialConfirmed && bothFilled;
  const adminCanEditOfficial = matchStage === "started";
  const body = buildQuinielaPredRowsHtml(m, session, official, isAdmin);

  const vh = off.home === "" ? "" : escapeHtml(String(off.home));
  const va = off.away === "" ? "" : escapeHtml(String(off.away));

  let officialHtml;
  if (isAdmin) {
    if (matchStage === "finished" && bothFilled) {
      officialHtml = `
      <div class="quiniela-official quiniela-official--admin quiniela-official--locked" data-quiniela-mid="${escapeHtml(m.id)}">
        <div class="quiniela-official-head">Resultado oficial <span class="quiniela-badge-confirmed">Confirmado</span></div>
        <div class="quiniela-official-grid quiniela-official-grid--readonly">
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.home)}</div>
          <div class="quiniela-cell quiniela-cell--score">${vh}</div>
          <div class="quiniela-cell quiniela-cell--score">${va}</div>
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.away)}</div>
        </div>
        <div class="quiniela-official-actions">
          <button type="button" class="btn btn-sm quiniela-btn-desconfirmar-partido" data-mid="${escapeHtml(m.id)}">Desconfirmar partido</button>
          <button type="button" class="btn btn-sm quiniela-btn-reiniciar-partido" data-mid="${escapeHtml(m.id)}">Reiniciar partido</button>
        </div>
        <p class="quiniela-official-hint muted">Resultado final confirmado. Desconfirmar vuelve a etapa iniciada; reiniciar abre de nuevo el partido para todos.</p>
      </div>`;
    } else if (adminCanEditOfficial) {
      const canFinish = bothFilled;
      officialHtml = `
      <div class="quiniela-official quiniela-official--admin quiniela-official--editing" data-quiniela-mid="${escapeHtml(m.id)}">
        <div class="quiniela-official-head">Resultado oficial</div>
        <div class="quiniela-official-grid quiniela-official-grid--edit">
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.home)}</div>
          <div class="quiniela-cell quiniela-cell--score">${scoreStepperHtml(m.id, "home", off.home, { extraClass: "quiniela-official-stepper", disabled: false })}</div>
          <div class="quiniela-cell quiniela-cell--score">${scoreStepperHtml(m.id, "away", off.away, { extraClass: "quiniela-official-stepper", disabled: false })}</div>
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.away)}</div>
        </div>
        <div class="quiniela-official-actions">
          <button type="button" class="btn btn-primary btn-sm quiniela-btn-terminar-partido" data-mid="${escapeHtml(m.id)}" ${canFinish ? "" : "disabled"}>Terminar partido</button>
        </div>
        <p class="quiniela-official-hint muted">Partido iniciado: solo Tivo puede ajustar el marcador oficial hasta terminarlo.</p>
      </div>`;
    } else {
      officialHtml = `
      <div class="quiniela-official quiniela-official--admin quiniela-official--locked" data-quiniela-mid="${escapeHtml(m.id)}">
        <div class="quiniela-official-head">Resultado oficial</div>
        <div class="quiniela-official-grid quiniela-official-grid--readonly">
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.home)}</div>
          <div class="quiniela-cell quiniela-cell--score">${vh || "—"}</div>
          <div class="quiniela-cell quiniela-cell--score">${va || "—"}</div>
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.away)}</div>
        </div>
        <div class="quiniela-official-actions">
          <button type="button" class="btn btn-primary btn-sm quiniela-btn-iniciar-partido" data-mid="${escapeHtml(m.id)}">Iniciar partido</button>
        </div>
        <p class="quiniela-official-hint muted">Antes de iniciar, todos pueden editar/confirmar su predicción. Tivo aún no puede cambiar el marcador oficial.</p>
      </div>`;
    }
  } else {
    officialHtml = `
      <div class="quiniela-official">
        <div class="quiniela-official-head">Resultado oficial</div>
        <div class="quiniela-official-grid quiniela-official-grid--readonly">
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.home)}</div>
          <div class="quiniela-cell quiniela-cell--score">${showPublicScore ? vh : "—"}</div>
          <div class="quiniela-cell quiniela-cell--score">${showPublicScore ? va : "—"}</div>
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.away)}</div>
        </div>
      </div>`;
  }

  return `
    <article class="card quiniela-match" data-group="${escapeHtml(m.groupId)}" data-quiniela-mid="${escapeHtml(m.id)}">
      <h2 class="quiniela-match-title">Grupo ${escapeHtml(m.groupId)} · ${teamLabelHtml(m.home)} <span class="vs">vs</span> ${teamLabelHtml(m.away)}</h2>
      ${quinielaMatchStatusBanner(matchStage, officialConfirmed)}
      ${officialHtml}
      <div class="quiniela-preds-head">Predicciones</div>
      <div class="table-scroll quiniela-table-wrap">
        <table class="table table-compact quiniela-preds">
          <thead>
            <tr>
              <th>Participante</th>
              <th class="quiniela-num">${escapeHtml(m.home)}</th>
              <th class="quiniela-num">${escapeHtml(m.away)}</th>
              <th class="quiniela-num quiniela-ganador-col" scope="col">Ganador</th>
              <th class="quiniela-num">Pts</th>
              <th class="quiniela-actions-col" scope="col"><span class="visually-hidden">Acción</span></th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </article>`;
}

/**
 * @param {{ participantId: string } | null} session
 * @param {ReturnType<typeof loadOfficialResults>} official
 */
function renderQuiniela(session, official) {
  ensurePartidosScopeFilter();
  ensureQuinielaFilter();
  const wrap = $("#quiniela-wrap");
  const intro = $("#partidos-intro");
  if (!wrap || !intro) return;

  if (!session) {
    intro.textContent = "Entra con tu participante para ver tus partidos.";
    wrap.innerHTML = "";
    return;
  }

  const isAdmin = canEditOfficialResults(session.participantId);
  const scopeEl = $("#partidos-scope-filter");
  const scope = scopeEl?.value ?? "grupos";
  setPartidosGroupToolbarVisible(scope === "grupos");

  if (scope === "grupos") {
    intro.innerHTML = isAdmin
      ? "Admin: inicia, termina o reinicia partidos para gestionar resultados oficiales."
      : "Usa <strong>+ / −</strong> y <strong>Confirmar</strong> para tus marcadores. La tabla te mostrara tus aciertos y puntos.";
  } else {
    intro.innerHTML =
      "En eliminatoria puedes editar y confirmar tu marcador. Los puntos se calculan con el resultado oficial confirmado.";
  }

  const blocks = [];
  if (scope === "grupos") {
    const filterEl = $("#quiniela-group-filter");
    const groupFilter = filterEl?.value ?? "";
    const matches = groupFilter ? GROUP_MATCHES.filter((m) => m.groupId === groupFilter) : GROUP_MATCHES;
    blocks.push(...matches.map((m) => renderQuinielaMatchCard(m, session, official, isAdmin)));
  } else {
    let koList = getKnockoutMatchesFlat();
    if (scope !== "all-ko") koList = koList.filter((x) => x.roundId === scope);
    blocks.push(...koList.map((m) => renderQuinielaMatchCardKo(m, session, official, isAdmin)));
  }
  wrap.innerHTML = blocks.join("");

  wireQuinielaPredictionHandlersInScope(wrap, session);

  if (isAdmin) {
    wrap.querySelectorAll(".quiniela-btn-iniciar-partido").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mid = btn.dataset.mid;
        if (!mid) return;
        saveOfficialResults({ groupMatchState: { [mid]: "started" } });
        refreshAll(loadSession());
      });
    });

    wrap.querySelectorAll(".quiniela-official--editing").forEach((ed) => {
      wireScoreSteppers(ed, "grupos", (partial) => {
        const mid = ed.dataset.quinielaMid;
        if (!mid || !partial[mid]) return;
        const offNow = loadOfficialResults();
        if ((offNow.groupMatchState?.[mid] ?? "ready") !== "started") return;
        const cur = loadOfficialResults();
        const gs = { ...cur.groupScores };
        gs[mid] = { home: partial[mid].home, away: partial[mid].away };
        saveOfficialResults({ groupScores: gs });
        const termBtn = ed.querySelector(".quiniela-btn-terminar-partido");
        if (termBtn) {
          termBtn.disabled = partial[mid].home === "" || partial[mid].away === "";
        }
        patchQuinielaMatchPredRows(wrap, mid);
      });
    });

    wrap.querySelectorAll(".quiniela-btn-terminar-partido").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mid = btn.dataset.mid;
        if (!mid) return;
        const cur = loadOfficialResults();
        if ((cur.groupMatchState?.[mid] ?? "ready") !== "started") return;
        const sc = cur.groupScores[mid] ?? { home: "", away: "" };
        if (sc.home === "" || sc.away === "") return;
        saveOfficialResults({
          groupScoresConfirmed: { [mid]: true },
          groupMatchState: { [mid]: "finished" },
        });
        refreshAll(loadSession());
      });
    });

    wrap.querySelectorAll(".quiniela-btn-desconfirmar-partido").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mid = btn.dataset.mid;
        if (!mid) return;
        const cur = loadOfficialResults();
        if ((cur.groupMatchState?.[mid] ?? "ready") !== "finished") return;
        const { [mid]: _r, ...rest } = cur.groupScoresConfirmed ?? {};
        saveOfficialResults({
          groupScoresConfirmed: rest,
          replaceGroupScoresConfirmed: true,
          groupMatchState: { [mid]: "started" },
        });
        refreshAll(loadSession());
      });
    });

    wrap.querySelectorAll(".quiniela-btn-reiniciar-partido").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mid = btn.dataset.mid;
        if (!mid) return;
        const cur = loadOfficialResults();
        const { [mid]: _r, ...rest } = cur.groupScoresConfirmed ?? {};
        saveOfficialResults({
          groupScoresConfirmed: rest,
          replaceGroupScoresConfirmed: true,
          groupMatchState: { [mid]: "ready" },
        });
        refreshAll(loadSession());
      });
    });

    wrap.querySelectorAll(".partidos-ko-official--editing").forEach((ed) => {
      wireOfficialKnockoutSteppers(ed, (partial) => {
        const kid = ed.dataset.koMid;
        if (!kid || !partial[kid]) return;
        const latest = loadOfficialResults();
        const next = { ...latest.knockoutScores, [kid]: partial[kid] };
        const prev = latest.knockoutScores?.[kid];
        const changed =
          !prev ||
          String(prev.home ?? "") !== String(partial[kid].home ?? "") ||
          String(prev.away ?? "") !== String(partial[kid].away ?? "");
        saveOfficialResults({
          knockoutScores: next,
          ...(changed && latest.knockoutScoresConfirmed?.[kid] === true
            ? { knockoutScoresConfirmed: { [kid]: false } }
            : {}),
        });
        redrawQuiniela();
        refreshAll(loadSession());
      });
    });

    wrap.querySelectorAll(".partidos-ko-btn-confirm").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kid = btn.dataset.kid;
        if (!kid) return;
        const o = loadOfficialResults();
        const sc = o.knockoutScores?.[kid];
        if (!sc || sc.home === "" || sc.away === "") return;
        saveOfficialResults({ knockoutScoresConfirmed: { [kid]: true } });
        redrawQuiniela();
        refreshAll(loadSession());
      });
    });

    wrap.querySelectorAll(".partidos-ko-btn-unconfirm").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kid = btn.dataset.kid;
        if (!kid) return;
        saveOfficialResults({ knockoutScoresConfirmed: { [kid]: false } });
        redrawQuiniela();
        refreshAll(loadSession());
      });
    });
  }

  redrawTeamStats();
}

/**
 * @param {Record<string, { home: string|number|"", away: string|number|"" }>} groupScores
 * @param {{ simplified?: boolean }} [opts]
 */
function buildTeamStatsTableBody(groupScores, opts = {}) {
  const { simplified = false } = opts;
  const rows = [];
  const standingsByGroup = computeGroupStandingsByGroup(groupScores);

  for (const grp of GROUPS) {
    const ordered = standingsByGroup[grp.id] ?? [];
    const colSpan = simplified ? 3 : 7;

    rows.push(
      `<tr class="team-stats-divider"><td colspan="${colSpan}">Grupo ${escapeHtml(grp.id)}</td></tr>`,
    );

    ordered.forEach((s, idx) => {
      rows.push(`
        <tr>
          <td>${idx + 1}</td>
          <td>${teamLabelHtml(s.team)}</td>
          ${simplified ? "" : `<td class="team-stats-extra-col">${s.played}</td>`}
          ${simplified ? "" : `<td class="team-stats-extra-col">${s.wins}</td>`}
          ${simplified ? "" : `<td class="team-stats-extra-col">${s.draws}</td>`}
          ${simplified ? "" : `<td class="team-stats-extra-col">${s.losses}</td>`}
          <td>${s.pts}</td>
        </tr>
      `);
    });
  }

  return rows.join("");
}

function getOfficialConfirmedGroupScores() {
  const off = loadOfficialResults();
  /** @type {Record<string, { home: string|number|"", away: string|number|"" }>} */
  const scores = {};
  for (const m of GROUP_MATCHES) {
    if (off.groupScoresConfirmed?.[m.id] !== true) continue;
    const sc = off.groupScores[m.id];
    if (sc && sc.home !== "" && sc.away !== "") scores[m.id] = { home: sc.home, away: sc.away };
  }
  return scores;
}

function teamStatsSourceOptionsHtml() {
  const options = ['<option value="official">Resultado oficial</option>'];
  for (const p of getParticipants()) {
    options.push(`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`);
  }
  return options.join("");
}

function ensureTeamStatsSourceSelects() {
  const left = $("#team-stats-left-source");
  const right = $("#team-stats-right-source");
  if (!left || !right) return;
  if (left.dataset.ready === "1" && right.dataset.ready === "1") return;
  const html = teamStatsSourceOptionsHtml();
  if (left.dataset.ready !== "1") {
    left.innerHTML = html;
    left.addEventListener("change", () => {
      localStorage.setItem(TEAM_STATS_LEFT_SOURCE_KEY, left.value);
      redrawTeamStats();
    });
    left.dataset.ready = "1";
  }
  if (right.dataset.ready !== "1") {
    right.innerHTML = html;
    right.addEventListener("change", () => {
      localStorage.setItem(TEAM_STATS_RIGHT_SOURCE_KEY, right.value);
      redrawTeamStats();
    });
    right.dataset.ready = "1";
  }
}

function ensureTeamStatsViewSelect() {
  const radios = [...document.querySelectorAll('input[name="team-stats-view"]')];
  if (radios.length === 0 || radios[0].dataset.ready === "1") return;
  const saved = localStorage.getItem(TEAM_STATS_VIEW_KEY);
  const preferred = saved === "simple" ? "simple" : "full";
  radios.forEach((r) => {
    r.checked = r.value === preferred;
    r.addEventListener("change", () => {
      const checked = document.querySelector('input[name="team-stats-view"]:checked');
      const next = checked?.value === "simple" ? "simple" : "full";
      localStorage.setItem(TEAM_STATS_VIEW_KEY, next);
      redrawTeamStats();
    });
    r.dataset.ready = "1";
  });
}

function refreshTeamStatsSelectValues(defaultParticipantId) {
  const left = $("#team-stats-left-source");
  const right = $("#team-stats-right-source");
  if (!left || !right) return;
  const valid = (val) => [...left.options].some((o) => o.value === val);
  const savedLeft = localStorage.getItem(TEAM_STATS_LEFT_SOURCE_KEY);
  const savedRight = localStorage.getItem(TEAM_STATS_RIGHT_SOURCE_KEY);

  if (savedLeft && valid(savedLeft)) left.value = savedLeft;
  else left.value = "official";

  if (savedRight && valid(savedRight)) right.value = savedRight;
  else if (defaultParticipantId && valid(defaultParticipantId)) right.value = defaultParticipantId;
  else right.value = left.options[0]?.value ?? "official";
}

/** Actualiza opciones cuando el admin cambia la lista de participantes. */
function rebuildTeamStatsSelectOptions() {
  const left = $("#team-stats-left-source");
  const right = $("#team-stats-right-source");
  if (!left || !right) return;
  const session = loadSession();
  const html = teamStatsSourceOptionsHtml();
  left.innerHTML = html;
  right.innerHTML = html;
  refreshTeamStatsSelectValues(session?.participantId ?? "");
}

function teamStatsSourceSubtitle(sourceId, sessionParticipantId) {
  if (sourceId === "official") return "Fase de grupos · Resultado oficial (confirmado)";
  const p = getParticipantById(sourceId);
  if (sourceId === sessionParticipantId) return "Fase de grupos · Tu predicción";
  return `Fase de grupos · Predicción de ${p?.name ?? "Participante"}`;
}

function teamStatsSourceToneClass(sourceId, sessionParticipantId) {
  if (sourceId === "official") return "team-stats-col-tone--official";
  if (sourceId === sessionParticipantId) return "team-stats-col-tone--self";
  return "team-stats-col-tone--other";
}

function applyTeamStatsColumnTone(bodyEl, sourceId, sessionParticipantId) {
  const col = bodyEl?.closest(".team-stats-col");
  if (!col) return;
  col.classList.remove(
    "team-stats-col-tone--official",
    "team-stats-col-tone--self",
    "team-stats-col-tone--other",
  );
  col.classList.add(teamStatsSourceToneClass(sourceId, sessionParticipantId));
}

function buildTeamOrderTableBody(orderByGroup) {
  const rows = [];
  for (const grp of GROUPS) {
    rows.push(`<tr class="team-stats-divider"><td colspan="2">Grupo ${escapeHtml(grp.id)}</td></tr>`);
    const order = Array.isArray(orderByGroup?.[grp.id]) ? orderByGroup[grp.id] : [];
    for (let i = 0; i < 4; i++) {
      const t = order[i] ?? "";
      rows.push(`
        <tr>
          <td>${i + 1}</td>
          <td>${t ? teamLabelHtml(t) : '<span class="muted">—</span>'}</td>
        </tr>
      `);
    }
  }
  return rows.join("");
}

function buildTeamOrderOfficialTableBody(officialSnapshot) {
  const rows = [];
  const perGroupPossible = MAX_PER_GROUP;
  let totalPossible = 0;
  for (const grp of GROUPS) {
    rows.push(`<tr class="team-stats-divider"><td colspan="3">Grupo ${escapeHtml(grp.id)}</td></tr>`);
    const order = Array.isArray(officialSnapshot.orderByGroup?.[grp.id])
      ? officialSnapshot.orderByGroup[grp.id]
      : [];
    for (let i = 0; i < 4; i++) {
      const t = order[i] ?? "";
      rows.push(`
        <tr>
          <td>${i + 1}</td>
          <td>${t ? teamLabelHtml(t) : '<span class="muted">—</span>'}</td>
          <td class="team-order-points-cell"><span class="muted">—</span></td>
        </tr>
      `);
    }
    const groupPossible = perGroupPossible;
    totalPossible += perGroupPossible;
    rows.push(`
      <tr class="team-order-total-row">
        <td colspan="2"><strong>Total posible</strong></td>
        <td class="team-order-total-num"><strong>${groupPossible}</strong></td>
      </tr>
    `);
  }
  rows.push(`
    <tr class="team-order-total-row team-order-total-row--final">
      <td colspan="2"><strong>Total posible</strong></td>
      <td class="team-order-total-num"><strong>${totalPossible}</strong></td>
    </tr>
  `);
  return rows.join("");
}

function teamOrderSourceOptionsHtml() {
  const options = ['<option value="official">Orden oficial</option>'];
  for (const p of getParticipants()) {
    options.push(`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`);
  }
  return options.join("");
}

function teamOrderSourceSubtitle(sourceId, side, sessionParticipantId) {
  if (sourceId === "official") return "Fase de grupos · Orden oficial";
  const p = getParticipantById(sourceId);
  if (sourceId === sessionParticipantId) return `Fase de grupos · ${side === "left" ? "Tu orden" : "Tu orden"}`;
  return `Fase de grupos · Orden de ${p?.name ?? "Participante"}`;
}

function teamOrderGroupTotalClass(groupTotal, isOfficialSource) {
  if (isOfficialSource) return "";
  if (groupTotal > MAX_PER_GROUP) return "team-order-total-value team-order-total-value--rainbow";
  if (groupTotal === MAX_PER_GROUP) return "team-order-total-value team-order-total-value--gold";
  return "";
}

function teamOrderSourceToneClass(sourceId, sessionParticipantId) {
  if (sourceId === "official") return "team-order-col--official";
  if (sourceId === sessionParticipantId) return "team-order-col--self";
  return "team-order-col--other";
}

function applyTeamOrderColumnTone(bodyEl, sourceId, sessionParticipantId) {
  const col = bodyEl?.closest(".team-stats-col");
  if (!col) return;
  col.classList.remove("team-order-col--official", "team-order-col--self", "team-order-col--other");
  col.classList.add(teamOrderSourceToneClass(sourceId, sessionParticipantId));
}

function buildTeamOrderPredTableBody(orderByGroup, officialSnapshot, participantId, sessionParticipantId) {
  const rows = [];
  const pStore = loadPredictions(participantId);
  let grandTotal = 0;

  for (const grp of GROUPS) {
    const officialOrder = officialSnapshot.orderByGroup?.[grp.id] ?? [];
    const hasOfficialData = officialSnapshot.hasOfficialDataByGroup?.[grp.id] === true;
    const officialThird = officialSnapshot.thirdAdvanceByGroup?.[grp.id];
    const officialThirdDefined = officialThird === true || officialThird === false;
    const voteCountsByPos = getGroupOrderVoteCountsByPosition(grp.id);
    const order = Array.isArray(orderByGroup?.[grp.id]) ? orderByGroup[grp.id] : [];
    const predOrder = [0, 1, 2, 3].map((i) => (typeof order[i] === "string" ? order[i] : ""));
    const predThird = pStore.groupThirdAdvances?.[grp.id];
    const officialQualifiers = new Set([officialOrder[0], officialOrder[1]].filter(Boolean));
    const top2InExactOrder =
      hasOfficialData &&
      Boolean(predOrder[0]) &&
      Boolean(predOrder[1]) &&
      predOrder[0] === officialOrder[0] &&
      predOrder[1] === officialOrder[1];
    const fullOrderHit =
      hasOfficialData &&
      [0, 1, 2, 3].every(
        (i) =>
          Boolean(predOrder[i]) &&
          Boolean(officialOrder[i]) &&
          predOrder[i] === officialOrder[i],
      );
    const perfectOrderPts = GROUP_QUALIFIERS_ORDER_BONUS + GROUP_PERFECT_ORDER_BONUS;
    let groupBadge = "";
    if (fullOrderHit) {
      groupBadge = `<span class="team-order-inline-bonus"><span class="group-preds-perfecto-label">Perfecto</span>${pointsBadgeHtml(perfectOrderPts, {
        title: `+${GROUP_QUALIFIERS_ORDER_BONUS} por orden de 1.º y 2.º y +${GROUP_PERFECT_ORDER_BONUS} por el grupo completo`,
      })}</span>`;
    } else if (top2InExactOrder) {
      groupBadge = `<span class="team-order-inline-bonus"><span class="group-preds-bien-label">Bien</span>${pointsBadgeHtml(GROUP_QUALIFIERS_ORDER_BONUS, {
        title: `+${GROUP_QUALIFIERS_ORDER_BONUS} por orden correcto de 1.º y 2.º`,
      })}</span>`;
    }

    rows.push(`<tr class="team-stats-divider"><td colspan="3"><div class="team-order-group-head"><span>Grupo ${escapeHtml(grp.id)}</span>${groupBadge}</div></td></tr>`);

    for (let i = 0; i < 4; i++) {
      const t = predOrder[i] ?? "";
      const rowBasePts =
        hasOfficialData && i < 2 && Boolean(t) && officialQualifiers.has(t)
          ? 1
          : 0;
      const rowBonusPts =
        hasOfficialData &&
        Boolean(t) &&
        Boolean(officialOrder[i]) &&
        t === officialOrder[i] &&
        hasUniquePickBonus(voteCountsByPos[i], t)
          ? 1
          : 0;
      const rowPts = rowBasePts + rowBonusPts;
      rows.push(`
        <tr>
          <td>${i + 1}</td>
          <td>${t ? teamLabelHtml(t) : '<span class="muted">—</span>'}</td>
          <td class="team-order-points-cell">${pointsBadgeHtml(rowPts, {
            bonus: rowBonusPts > 0,
            title:
              rowBonusPts > 0
                ? rowBasePts > 0
                  ? "Acierto en posición con bono por minoría (+1 base +1 bono)"
                  : "Acierto en posición con bono por minoría (+1 bono)"
                : "Clasificado directo acertado (+1)",
          }) || '<span class="muted">—</span>'}</td>
        </tr>
      `);
    }

    const baseGroupTotal = hasOfficialData
      ? computeGroupOrderPoints(
          predOrder,
          officialOrder,
          predThird,
          officialThirdDefined ? officialThird : undefined,
        )
      : 0;
    const minorityBonusTotal = hasOfficialData
      ? [0, 1, 2, 3].reduce((acc, i) => {
          const t = predOrder[i];
          const isExact = Boolean(t) && Boolean(officialOrder[i]) && t === officialOrder[i];
          if (isExact && hasUniquePickBonus(voteCountsByPos[i], t)) return acc + 1;
          return acc;
        }, 0)
      : 0;
    const groupTotal = baseGroupTotal + minorityBonusTotal;
    grandTotal += groupTotal;
    const totalClass = teamOrderGroupTotalClass(groupTotal, false);
    rows.push(`
      <tr class="team-order-total-row">
        <td colspan="2"><strong>Total grupo</strong></td>
        <td class="team-order-total-num"><strong class="${totalClass}">${groupTotal}</strong></td>
      </tr>
    `);
  }

  rows.push(`
    <tr class="team-order-total-row team-order-total-row--final">
      <td colspan="2"><strong>Total final</strong></td>
      <td class="team-order-total-num"><strong>${grandTotal}</strong></td>
    </tr>
  `);
  return rows.join("");
}

function ensureTeamOrderSourceSelects() {
  const left = $("#team-order-left-source");
  const right = $("#team-order-right-source");
  if (!left || !right) return;
  if (left.dataset.ready === "1" && right.dataset.ready === "1") return;
  const html = teamOrderSourceOptionsHtml();
  if (left.dataset.ready !== "1") {
    left.innerHTML = html;
    left.addEventListener("change", () => {
      localStorage.setItem(TEAM_ORDER_LEFT_SOURCE_KEY, left.value);
      redrawTeamOrder();
    });
    left.dataset.ready = "1";
  }
  if (right.dataset.ready !== "1") {
    right.innerHTML = html;
    right.addEventListener("change", () => {
      localStorage.setItem(TEAM_ORDER_RIGHT_SOURCE_KEY, right.value);
      redrawTeamOrder();
    });
    right.dataset.ready = "1";
  }
}

function refreshTeamOrderSelectValues(defaultParticipantId) {
  const left = $("#team-order-left-source");
  const right = $("#team-order-right-source");
  if (!left || !right) return;
  const valid = (val) => [...left.options].some((o) => o.value === val);
  const savedLeft = localStorage.getItem(TEAM_ORDER_LEFT_SOURCE_KEY);
  const savedRight = localStorage.getItem(TEAM_ORDER_RIGHT_SOURCE_KEY);
  left.value = savedLeft && valid(savedLeft) ? savedLeft : "official";
  if (savedRight && valid(savedRight)) {
    right.value = savedRight;
  } else if (defaultParticipantId && valid(defaultParticipantId)) {
    right.value = defaultParticipantId;
  } else {
    right.value = left.options[0]?.value ?? "official";
  }
}

function rebuildTeamOrderSelectOptions() {
  const left = $("#team-order-left-source");
  const right = $("#team-order-right-source");
  if (!left || !right) return;
  const session = loadSession();
  const html = teamOrderSourceOptionsHtml();
  left.innerHTML = html;
  right.innerHTML = html;
  refreshTeamOrderSelectValues(session?.participantId ?? "");
}

function redrawTeamStats() {
  const intro = $("#team-stats-intro");
  const officialBody = $("#table-team-stats-official-body");
  const predBody = $("#table-team-stats-pred-body");
  const officialSub = $("#team-stats-subtitle-official");
  const predSub = $("#team-stats-subtitle-pred");
  const compareWrap = $("#team-stats-compare");
  const panel = $("#panel-team-stats");
  const session = loadSession();

  if (!intro || !officialBody || !predBody) return;

  if (!session) {
    intro.textContent = "Entra con tu participante para ver la tabla de equipos.";
    officialBody.innerHTML = "";
    predBody.innerHTML = "";
    if (officialSub) officialSub.textContent = "Fase de grupos · Resultado oficial";
    if (predSub) predSub.textContent = "Fase de grupos · Predicción";
    compareWrap?.classList.remove("team-stats-compare--self-selected");
    return;
  }

  ensureTeamStatsSourceSelects();
  ensureTeamStatsViewSelect();
  refreshTeamStatsSelectValues(session.participantId);
  const leftSel = $("#team-stats-left-source");
  const rightSel = $("#team-stats-right-source");
  const viewChecked = document.querySelector('input[name="team-stats-view"]:checked');
  const simplified = viewChecked?.value === "simple";
  const leftSource = leftSel?.value ?? "official";
  const rightSource = rightSel?.value ?? session.participantId;
  localStorage.setItem(TEAM_STATS_LEFT_SOURCE_KEY, leftSource);
  localStorage.setItem(TEAM_STATS_RIGHT_SOURCE_KEY, rightSource);
  const isSelfSelected = rightSource === session.participantId;
  compareWrap?.classList.toggle("team-stats-compare--self-selected", isSelfSelected);

  const officialScores = getOfficialConfirmedGroupScores();
  const leftScores = leftSource === "official" ? officialScores : (loadPredictions(leftSource).groupScores ?? {});
  const rightScores =
    rightSource === "official" ? officialScores : (loadPredictions(rightSource).groupScores ?? {});

  intro.textContent = "Compara dos tablas de grupos lado a lado.";
  panel?.classList.toggle("team-stats--simple", simplified);
  if (officialSub) {
    officialSub.textContent = teamStatsSourceSubtitle(leftSource, session.participantId);
    officialSub.classList.toggle(
      "team-stats-subtitle--foreign",
      leftSource !== "official" && leftSource !== session.participantId,
    );
  }
  if (predSub) {
    predSub.textContent = teamStatsSourceSubtitle(rightSource, session.participantId);
    predSub.classList.toggle(
      "team-stats-subtitle--foreign",
      rightSource !== "official" && rightSource !== session.participantId,
    );
  }
  officialBody.innerHTML = buildTeamStatsTableBody(leftScores, { simplified });
  predBody.innerHTML = buildTeamStatsTableBody(rightScores, { simplified });
  applyTeamStatsColumnTone(officialBody, leftSource, session.participantId);
  applyTeamStatsColumnTone(predBody, rightSource, session.participantId);
}

function redrawTeamOrder() {
  const officialBody = $("#table-team-order-official-body");
  const predBody = $("#table-team-order-pred-body");
  const officialSub = $("#team-order-subtitle-official");
  const predSub = $("#team-order-subtitle-pred");
  const compareWrap = $("#team-order-compare");
  const session = loadSession();

  if (!officialBody || !predBody) return;
  if (!session) {
    officialBody.innerHTML = "";
    predBody.innerHTML = "";
    if (officialSub) officialSub.textContent = "Fase de grupos · Orden oficial";
    if (predSub) predSub.textContent = "Fase de grupos · Orden";
    compareWrap?.classList.remove("team-stats-compare--self-selected");
    return;
  }

  ensureTeamOrderSourceSelects();
  refreshTeamOrderSelectValues(session.participantId);
  const leftSel = $("#team-order-left-source");
  const rightSel = $("#team-order-right-source");
  const leftSource = leftSel?.value ?? "official";
  const rightSource = rightSel?.value ?? session.participantId;
  localStorage.setItem(TEAM_ORDER_LEFT_SOURCE_KEY, leftSource);
  localStorage.setItem(TEAM_ORDER_RIGHT_SOURCE_KEY, rightSource);
  const isSelfSelected = rightSource === session.participantId;
  compareWrap?.classList.toggle("team-stats-compare--self-selected", isSelfSelected);

  const officialSnapshot = getLiveOfficialGroupSnapshot();
  if (leftSource === "official") {
    officialBody.innerHTML = buildTeamOrderOfficialTableBody(officialSnapshot);
  } else {
    const leftOrder = loadPredictions(leftSource).groupOrder ?? {};
    officialBody.innerHTML = buildTeamOrderPredTableBody(
      leftOrder,
      officialSnapshot,
      leftSource,
      session.participantId,
    );
  }
  if (rightSource === "official") {
    predBody.innerHTML = buildTeamOrderOfficialTableBody(officialSnapshot);
  } else {
    const rightOrder = loadPredictions(rightSource).groupOrder ?? {};
    predBody.innerHTML = buildTeamOrderPredTableBody(
      rightOrder,
      officialSnapshot,
      rightSource,
      session.participantId,
    );
  }
  applyTeamOrderColumnTone(officialBody, leftSource, session.participantId);
  applyTeamOrderColumnTone(predBody, rightSource, session.participantId);

  if (officialSub) {
    const txt = teamOrderSourceSubtitle(leftSource, "left", session.participantId);
    officialSub.textContent = txt;
    officialSub.classList.toggle("team-stats-subtitle--foreign", leftSource !== "official" && leftSource !== session.participantId);
  }
  if (predSub) {
    const txt = teamOrderSourceSubtitle(rightSource, "right", session.participantId);
    predSub.textContent = txt;
    predSub.classList.toggle("team-stats-subtitle--foreign", rightSource !== "official" && rightSource !== session.participantId);
  }
}

function buildGroupOrderRankingRows(sessionParticipantId) {
  const officialSnapshot = getLiveOfficialGroupSnapshot();
  const rows = getParticipants().map((p) => {
    const pStore = loadPredictions(p.id);
    let bienCount = 0;
    let perfectoCount = 0;
    let bonusCount = 0;
    let totalPoints = 0;

    for (const grp of GROUPS) {
      const officialOrder = officialSnapshot.orderByGroup?.[grp.id] ?? [];
      const hasOfficialData = officialSnapshot.hasOfficialDataByGroup?.[grp.id] === true;
      if (!hasOfficialData) continue;
      const officialThird = officialSnapshot.thirdAdvanceByGroup?.[grp.id];
      const officialThirdDefined = officialThird === true || officialThird === false;
      const voteCountsByPos = getGroupOrderVoteCountsByPosition(grp.id);

      const order = pStore.groupOrder?.[grp.id];
      const predOrder =
        Array.isArray(order) && order.length >= 4
          ? [0, 1, 2, 3].map((i) => (typeof order[i] === "string" ? order[i] : ""))
          : ["", "", "", ""];
      const predThird = pStore.groupThirdAdvances?.[grp.id];

      const top2InExactOrder =
        Boolean(predOrder[0]) &&
        Boolean(predOrder[1]) &&
        predOrder[0] === officialOrder[0] &&
        predOrder[1] === officialOrder[1];
      const fullOrderHit = [0, 1, 2, 3].every(
        (i) => Boolean(predOrder[i]) && Boolean(officialOrder[i]) && predOrder[i] === officialOrder[i],
      );

      if (fullOrderHit) {
        perfectoCount += 1;
      } else if (top2InExactOrder) {
        bienCount += 1;
      }

      for (let i = 0; i < 4; i++) {
        const t = predOrder[i];
        const isExact = Boolean(t) && Boolean(officialOrder[i]) && t === officialOrder[i];
        if (isExact && hasUniquePickBonus(voteCountsByPos[i], t)) bonusCount += 1;
      }

      const basePts = computeGroupOrderPoints(
        predOrder,
        officialOrder,
        predThird,
        officialThirdDefined ? officialThird : undefined,
      );
      totalPoints += basePts;
    }

    totalPoints += bonusCount;
    return { participant: p, bienCount, perfectoCount, bonusCount, totalPoints };
  });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.perfectoCount !== a.perfectoCount) return b.perfectoCount - a.perfectoCount;
    if (b.bonusCount !== a.bonusCount) return b.bonusCount - a.bonusCount;
    if (b.bienCount !== a.bienCount) return b.bienCount - a.bienCount;
    return a.participant.name.localeCompare(b.participant.name);
  });

  const maxBien = Math.max(0, ...rows.map((r) => r.bienCount));
  const maxPerfecto = Math.max(0, ...rows.map((r) => r.perfectoCount));
  const maxBonus = Math.max(0, ...rows.map((r) => r.bonusCount));
  const maxTotal = Math.max(0, ...rows.map((r) => r.totalPoints));

  return rows
    .map((r, idx) => {
      const isSelf = r.participant.id === sessionParticipantId;
      const rowCls = ["group-ranking-row", isSelf ? "row-self" : ""].filter(Boolean).join(" ");
      const rank = idx + 1;
      const bienCls = maxBien > 0 && r.bienCount === maxBien ? "group-ranking-cell--top" : "";
      const perfectoCls =
        maxPerfecto > 0 && r.perfectoCount === maxPerfecto ? "group-ranking-cell--top" : "";
      const bonusCls = maxBonus > 0 && r.bonusCount === maxBonus ? "group-ranking-cell--top" : "";
      const totalCls = maxTotal > 0 && r.totalPoints === maxTotal ? "group-ranking-cell--top" : "";
      const you = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      return `<tr class="${rowCls}">
        <td class="group-ranking-rank">${rank}</td>
        <th scope="row" class="group-ranking-name">${escapeHtml(r.participant.name)}${you}</th>
        <td class="group-ranking-num ${bienCls}">${r.bienCount}</td>
        <td class="group-ranking-num ${perfectoCls}">${r.perfectoCount}</td>
        <td class="group-ranking-num ${bonusCls}">${r.bonusCount}</td>
        <td class="group-ranking-num ${totalCls}"><strong>${r.totalPoints}</strong></td>
      </tr>`;
    })
    .join("");
}

function redrawTeamOrderRanking() {
  const body = $("#table-team-order-ranking-body");
  const intro = $("#team-order-ranking-intro");
  const session = loadSession();
  if (!body || !intro) return;
  if (!session) {
    body.innerHTML = "";
    intro.textContent = "";
    return;
  }
  intro.textContent = "Ranking de fase de grupos con aciertos, bonus y puntos totales.";
  body.innerHTML = buildGroupOrderRankingRows(session.participantId);
}

function refreshAll(session) {
  if (session) {
    const p = getParticipantById(session.participantId);
    if (p && p.pin != null && p.pin !== "" && !isPinVerified(p.id, p.pin)) {
      clearSession();
      session = null;
      window.dispatchEvent(new CustomEvent("pm26-pin-stale"));
    }
  }
  updateSessionBar(session);
  renderStats(session);
  renderFloatingRanking(session);
  ensureFaseGruposFilter();
  if (!session) {
    $("#form-generales").innerHTML =
      '<p class="muted">Elige participante arriba (menú o al cargar) para editar predicciones.</p>';
    const genPredHost = $("#generales-preds-host");
    if (genPredHost) genPredHost.innerHTML = "";
    const genAdmin = $("#generales-official-admin");
    if (genAdmin) {
      genAdmin.innerHTML = "";
      genAdmin.hidden = true;
    }
    hideGroupBestThirdSummary();
    $("#grupos-wrap").innerHTML = "";
    $("#brackets-wrap").innerHTML = "";
    $("#team-stats-intro").textContent = "";
    $("#table-team-stats-official-body").innerHTML = "";
    $("#table-team-stats-pred-body").innerHTML = "";
    $("#table-team-order-official-body").innerHTML = "";
    $("#table-team-order-pred-body").innerHTML = "";
    $("#table-team-order-ranking-body").innerHTML = "";
    $("#table-match-ranking-body").innerHTML = "";
    $("#table-match-history-body").innerHTML = "";
    $("#table-final-ranking-body").innerHTML = "";
    renderQuiniela(null, loadOfficialResults());
    return;
  }
  const predictions = loadPredictions(session.participantId);
  renderGenerales(session.participantId, predictions, false);
  renderGrupos(session.participantId, predictions);
  renderBrackets(session.participantId, predictions);
  redrawTeamStats();
  redrawTeamOrder();
  redrawTeamOrderRanking();
  redrawMatchRanking();
  redrawMatchHistory();
  renderFinalRanking(session);
  renderQuiniela(session, loadOfficialResults());
  rebuildTeamStatsSelectOptions();
  rebuildTeamOrderSelectOptions();
}

export function initApp() {
  bindGeneralesOfficialAdminActions();
  initFloatingRanking();
  ensureFaseGruposFilter();
  tabsController = initTabs((tabId) => {
    if (tabId === "partidos") redrawQuiniela();
    if (tabId === "team-stats") redrawTeamStats();
    if (tabId === "team-order") redrawTeamOrder();
    if (tabId === "team-order-ranking") redrawTeamOrderRanking();
    if (tabId === "match-ranking") redrawMatchRanking();
    if (tabId === "match-history") redrawMatchHistory();
    if (tabId === "final-ranking") renderFinalRanking(loadSession());
  });
  bindRulesQuickButton();

  window.addEventListener("storage", (e) => {
    if (e.key !== "pm26-official-results") return;
    refreshAll(loadSession());
  });

  window.addEventListener("pm26-remote-sync", () => {
    refreshAll(loadSession());
  });

  function afterSessionReady() {
    refreshAll(loadSession());
  }

  window.addEventListener("pm26-pin-stale", () => {
    showOnboarding(afterSessionReady);
  });

  bindAdminSettings(afterSessionReady);

  bindSessionChange(() => {
    showOnboarding(afterSessionReady);
    refreshAll(null);
  });

  let s = loadSession();
  if (s && getParticipantById(s.participantId)) {
    afterSessionReady();
  } else {
    clearSession();
    showOnboarding(afterSessionReady);
  }
}
