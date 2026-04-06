import {
  getParticipants,
  getParticipantsForDisplay,
  getParticipantById,
  getParticipantAccentHex,
  getParticipantDisplayHue,
  setParticipantColor,
  hasParticipantCustomAccent,
  hexToRgb,
  canEditOfficialResults,
  canEditAllParticipantsPredictions,
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
  GROUP_PERFECTO_ORDER_AND_THIRD_BONUS,
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
  knockoutRoundRequiresPenaltyPickOnDraw,
} from "./tournament.js";
import { isLockedAtKickoff } from "./locks.js";
import {
  formatKickoffShortSpanish,
  countdownLabelSpanish,
  getNextMatchDayHighlightIds,
  daysUntilKickoffLocal,
  isMatchOfficiallyClosed,
} from "./match-calendar.js";
import { syncQuinielaPerfectBonusCanvases } from "./quinielaPerfectBonusCanvas.js";
import { syncGroupPtsBadgeCanvases, initGroupPtsBadgeCanvasObserver } from "./groupPtsBadgeCanvas.js";
import { animate, stagger } from "animejs";

const TAB_KEY = "pm26-active-tab";
const BRACKET_FOCUS_KEY = "pm26-bracket-focus";
const PARTIDOS_SCOPE_KEY = "pm26-partidos-scope";
/** sessionStorage: al entrar por el atajo del header, mostrar solo la jornada próxima hasta que cambie «Vista». */
const PARTIDOS_NAV_PROXIMOS_SESSION_KEY = "pm26-partidos-nav-proximos";
/** Valor del &lt;select&gt; Vista cuando está activo el filtro «solo jornada próxima» (amarillo). La fase real sigue en PARTIDOS_SCOPE_KEY. */
const PARTIDOS_VISTA_SIGUIENTES_VALUE = "proximos-nav";
/** Vista: solo partidos con resultado oficial confirmado (grupos y eliminatoria). */
const PARTIDOS_VISTA_TERMINADOS_VALUE = "terminados";
const MATCH_RANK_SCOPE_KEY = "pm26-match-rank-scope";
const MATCH_RANK_GROUP_KEY = "pm26-match-rank-group";
const TEAM_STATS_LEFT_SOURCE_KEY = "pm26-team-stats-left-source";
const TEAM_STATS_RIGHT_SOURCE_KEY = "pm26-team-stats-right-source";
const TEAM_STATS_VIEW_KEY = "pm26-team-stats-view";
const TEAM_ORDER_LEFT_SOURCE_KEY = "pm26-team-order-left-source";
const TEAM_ORDER_RIGHT_SOURCE_KEY = "pm26-team-order-right-source";
/** Último participante con sesión: si cambia, se reinician tablas comparadas (oficial | tú). */
const COMPARE_TABLES_BOUND_PARTICIPANT_KEY = "pm26-compare-tables-bound-participant";
const STATS_COLOR_HINT_DISMISSED_KEY = "pm26-stats-color-hint-dismissed-v3";
const FASE_GRUPOS_FILTER_KEY = "pm26-fase-grupos-gid";
const FLOATING_RANK_POS_KEY = "pm26-floating-rank-pos";
const FLOATING_RANK_ENABLED_KEY = "pm26-floating-rank-enabled";
const MAX_BEST_THIRD_TEAMS = 8;
let tabsController = null;
/** Evita setTab al sincronizar details desde la pestaña activa. */
let drawerSyncMuteToggleNav = false;
let floatingRankingReady = false;

/** Abre la pestaña Partidos en vista «SIGUIENTES» (mismo atajo que el botón amarillo). */
function clearCompareTableParticipantBinding() {
  try {
    localStorage.removeItem(COMPARE_TABLES_BOUND_PARTICIPANT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Al entrar con otro participante: izquierda oficial, derecha el usuario actual (orden de grupos y tablas por partidos).
 * @param {string} participantId
 */
function resetCompareTableSourcesIfParticipantChanged(participantId) {
  if (!participantId) return;
  let prev = "";
  try {
    prev = localStorage.getItem(COMPARE_TABLES_BOUND_PARTICIPANT_KEY) ?? "";
  } catch {
    prev = "";
  }
  if (prev === participantId) return;
  try {
    localStorage.setItem(TEAM_STATS_LEFT_SOURCE_KEY, "official");
    localStorage.setItem(TEAM_STATS_RIGHT_SOURCE_KEY, participantId);
    localStorage.setItem(TEAM_ORDER_LEFT_SOURCE_KEY, "official");
    localStorage.setItem(TEAM_ORDER_RIGHT_SOURCE_KEY, participantId);
    localStorage.setItem(COMPARE_TABLES_BOUND_PARTICIPANT_KEY, participantId);
  } catch {
    /* ignore */
  }
}

function navigateToSiguientesPartidosTab() {
  try {
    sessionStorage.setItem(PARTIDOS_NAV_PROXIMOS_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
  tabsController?.setTab("partidos");
  document.dispatchEvent(new CustomEvent("pm26-nav-drawer-close"));
}

function isStatsColorHintDismissed() {
  try {
    return localStorage.getItem(STATS_COLOR_HINT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissStatsColorHint() {
  try {
    localStorage.setItem(STATS_COLOR_HINT_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Nombres de equipo conocidos en fase de grupos (para banderas en la llave). */
const BRACKET_KNOWN_TEAMS = new Set(GROUPS.flatMap((g) => g.teams));

/** Equipo conocido y ya definido (no placeholder «Por determinar»). */
function isQuinielaTeamSlotDecided(teamName) {
  return BRACKET_KNOWN_TEAMS.has(teamName) && !isPlaceholderTeam(teamName);
}

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
  for (const part of getParticipantsForDisplay()) {
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
  for (const part of getParticipantsForDisplay()) {
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
  for (const part of getParticipantsForDisplay()) {
    const store = loadPredictions(part.id);
    if (store.knockoutScoresConfirmed?.[matchId] !== true) continue;
    const pred = store.knockoutScores?.[matchId] ?? {};
    const s = predictionOutcomeSign(pred);
    if (s) votes.push(s);
  }
  return votes;
}

/**
 * Bono improbable por menor votación del resultado oficial.
 * Reglas adicionales:
 * - Si hay 2 o más signos empatados como menor votada, todos esos aplican.
 * - Solo aplica cuando esa menor votación es <= 2.
 * - Si la menor votación empatada es >= 3, no aplica.
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
  if (minN > 2) return null;

  const minTier = withVotes.filter((x) => x.n === minN).map((x) => x.k);
  if (minTier.length < 1) return null;
  return minTier.includes(officialSign) ? officialSign : null;
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

/**
 * @param {{ groupOrderConfirmed?: Record<string, boolean> } | null | undefined} predictions
 */
function syncFaseGruposConfirmStatus(predictions) {
  const el = $("#fase-grupos-confirm-status");
  if (!el) return;
  const total = GROUPS.length;
  const confirmed = GROUPS.filter((g) => predictions?.groupOrderConfirmed?.[g.id] === true).length;
  el.classList.remove("fase-grupos-confirm-status--complete");
  if (confirmed >= total) {
    el.textContent = "Todas las predicciones confirmadas.";
    el.classList.add("fase-grupos-confirm-status--complete");
  } else {
    el.textContent = `Has confirmado ${confirmed}/${total} grupos.`;
  }
}

function closeFaseGruposComboList() {
  const list = $("#fase-grupos-filter-list");
  const trigger = $("#fase-grupos-filter-trigger");
  if (list) list.hidden = true;
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

/**
 * @param {{ groupOrderConfirmed?: Record<string, boolean> } | null | undefined} predictions
 */
function updateFaseGruposFilterTriggerHtml(predictions) {
  const wrap = $(".fase-grupos-filter-trigger__text");
  const sel = $("#fase-grupos-filter");
  if (!wrap || !sel) return;
  const v = sel.value;
  if (!v) {
    wrap.innerHTML = `<span class="fase-grupos-filter-option__label">— Elige grupo —</span>`;
    return;
  }
  const conf = predictions?.groupOrderConfirmed ?? {};
  const done = conf[v] === true;
  const mark = done
    ? `<span class="fase-grupos-filter-mark fase-grupos-filter-mark--ok" aria-hidden="true">✓</span>`
    : `<span class="fase-grupos-filter-mark fase-grupos-filter-mark--no" aria-hidden="true">✗</span>`;
  wrap.innerHTML = `<span class="fase-grupos-filter-option__label">Grupo ${escapeHtml(v)}</span>${mark}`;
}

function setFaseGruposFilterValue(value) {
  const sel = $("#fase-grupos-filter");
  if (!sel || ![...sel.options].some((o) => o.value === value)) return;
  sel.value = value;
  localStorage.setItem(FASE_GRUPOS_FILTER_KEY, value);
  closeFaseGruposComboList();
  refreshAll(loadSession());
}

function ensureFaseGruposFilter() {
  const combo = $("#fase-grupos-combobox");
  const sel = $("#fase-grupos-filter");
  const trigger = $("#fase-grupos-filter-trigger");
  const list = $("#fase-grupos-filter-list");
  if (!combo || !sel || !trigger || !list) return;
  if (combo.dataset.ready === "1") return;

  sel.innerHTML = `<option value="">— Elige grupo —</option>`;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (list.hidden) {
      list.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    } else {
      closeFaseGruposComboList();
    }
  });

  list.addEventListener("click", (e) => {
    const li = e.target.closest(".fase-grupos-filter-option");
    if (!li) return;
    e.stopPropagation();
    setFaseGruposFilterValue(li.dataset.value ?? "");
  });

  combo.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", closeFaseGruposComboList);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFaseGruposComboList();
  });

  combo.dataset.ready = "1";
  sel.dataset.ready = "1";
}

/**
 * Lista personalizada: texto «Grupo X» normal, solo ✓ (verde) / ✗ (rojo) coloreados.
 * El &lt;select&gt; oculto conserva el valor para el resto de la app.
 * @param {{ groupOrderConfirmed?: Record<string, boolean> } | null | undefined} predictions
 */
function syncFaseGruposFilterOptions(predictions) {
  const sel = $("#fase-grupos-filter");
  const list = $("#fase-grupos-filter-list");
  if (!sel || sel.dataset.ready !== "1" || !list) return;

  const saved = localStorage.getItem(FASE_GRUPOS_FILTER_KEY);
  const prev = sel.value;
  sel.querySelectorAll("option:not([value=''])").forEach((o) => o.remove());

  for (const g of GROUPS) {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = `Grupo ${g.id}`;
    sel.appendChild(opt);
  }

  const pick =
    saved != null && [...sel.options].some((o) => o.value === saved)
      ? saved
      : [...sel.options].some((o) => o.value === prev)
        ? prev
        : "";
  if ([...sel.options].some((o) => o.value === pick)) sel.value = pick;

  const conf = predictions?.groupOrderConfirmed ?? {};
  const markHtml = (done) =>
    done
      ? `<span class="fase-grupos-filter-mark fase-grupos-filter-mark--ok" aria-hidden="true">✓</span>`
      : `<span class="fase-grupos-filter-mark fase-grupos-filter-mark--no" aria-hidden="true">✗</span>`;

  const rows = [
    `<li role="option" class="fase-grupos-filter-option" data-value="" tabindex="-1">
      <span class="fase-grupos-filter-option__label">— Elige grupo —</span>
    </li>`,
    ...GROUPS.map((g) => {
      const done = conf[g.id] === true;
      const title = done ? "Orden de este grupo confirmado" : "Falta confirmar el orden de este grupo";
      return `<li role="option" class="fase-grupos-filter-option" data-value="${escapeHtml(g.id)}" tabindex="-1" title="${escapeHtml(title)}">
        <span class="fase-grupos-filter-option__label">Grupo ${escapeHtml(g.id)}</span>
        ${markHtml(done)}
      </li>`;
    }),
  ];
  list.innerHTML = rows.join("");

  updateFaseGruposFilterTriggerHtml(predictions);
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

  const groupParticipantRowData = [...getParticipantsForDisplay()]
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
      /** Solo puntos del bloque «orden del grupo» (máx. 8); la quiniela por partido se ve en su pestaña. */
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
      if (hasOfficialData && fullOrderHit && thirdHit) {
        orderBonusUnderName = `<div class="quiniela-perfect-inline group-preds-order-bonus-inline" role="status" aria-label="Orden completo y acierto 3.º pasa"><span class="group-preds-perfecto-label">Perfecto</span>${pointsBadgeHtml(perfectOrderPts + GROUP_PERFECTO_ORDER_AND_THIRD_BONUS, {
          title: `+${GROUP_QUALIFIERS_ORDER_BONUS} por orden de 1.º y 2.º, +${GROUP_PERFECT_ORDER_BONUS} por el grupo completo y +${GROUP_PERFECTO_ORDER_AND_THIRD_BONUS} por acierto de 3.º pasa`,
        })}</div>`;
      } else if (hasOfficialData && fullOrderHit) {
        orderBonusUnderName = `<div class="quiniela-perfect-inline group-preds-order-bonus-inline" role="status" aria-label="Orden 1.º a 4.º exacto"><span class="group-preds-excelente-label">Excelente</span>${pointsBadgeHtml(perfectOrderPts, {
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
    <h2 class="subsection-title group-preds-table-title">Predicciones de todos</h2>
    <div class="table-scroll table-scroll--group-preds">
      <table class="table table-compact table-group-preds" aria-label="Predicciones de todos en el grupo ${escapeHtml(grp.id)}">
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
 * @param {{ collectOnInput?: boolean }} [wireOpts] si true, también en `input` (marcador oficial en vivo al teclear)
 */
function wireScoreSteppers(wrap, mode, onCommit, wireOpts = {}) {
  const { collectOnInput = false } = wireOpts;
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
    if (collectOnInput) {
      inp.addEventListener("input", () => collect());
    }
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

function initNavDrawer() {
  const drawer = /** @type {HTMLElement | null} */ (document.getElementById("nav-drawer"));
  const inner = /** @type {HTMLElement | null} */ (drawer?.querySelector(".nav-drawer-inner"));
  const backdrop = document.getElementById("nav-drawer-backdrop");
  const railBtn = document.getElementById("btn-nav-drawer-rail");
  if (!drawer || !inner || !backdrop || !railBtn) return;

  /**
   * @param {boolean} open
   * @param {{ focusRail?: boolean }} [opts]
   */
  function setOpen(open, opts = {}) {
    const { focusRail = false } = opts;
    drawer.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-drawer-open", open);
    railBtn.setAttribute("aria-expanded", open ? "true" : "false");
    railBtn.setAttribute("aria-label", open ? "Cerrar menú de secciones" : "Abrir menú de secciones");
    backdrop.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) {
      inner.removeAttribute("inert");
      drawer.querySelector(".tab")?.focus();
    } else {
      inner.setAttribute("inert", "");
      if (focusRail) railBtn.focus();
    }
  }

  backdrop.addEventListener("click", () => setOpen(false, { focusRail: true }));

  document.addEventListener("pm26-nav-drawer-close", () => {
    if (drawer?.classList.contains("is-open")) setOpen(false, { focusRail: false });
  });

  railBtn.addEventListener("click", () => {
    const open = drawer.classList.contains("is-open");
    if (open) setOpen(false, { focusRail: true });
    else setOpen(true);
  });

  inner.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target : null;
    if (!el) return;
    if (el.closest(".drawer-nav-expand-btn")) return;
    const bannerEl = /** @type {HTMLButtonElement | null} */ (document.getElementById("nav-drawer-pending-banner"));
    if (el.closest("#nav-drawer-pending-banner") && bannerEl && !bannerEl.disabled && !bannerEl.hidden) {
      navigateToSiguientesPartidosTab();
      return;
    }
    if (el.closest(".tab")) {
      setOpen(false, { focusRail: false });
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) {
      setOpen(false, { focusRail: true });
    }
  });
}

/**
 * Abre el submenú que contiene la pestaña activa (p. ej. Tabla bajo Partidos), sin cerrar el resto.
 * @param {string} activeTabId
 */
function syncDrawerExpandableSubmenus(activeTabId) {
  drawerSyncMuteToggleNav = true;
  try {
    document.querySelectorAll("#nav-drawer .drawer-nav-expandable").forEach((section) => {
      const det = section.querySelector(".drawer-nav-details");
      const sub = section.querySelector(".drawer-nav-submenu");
      if (!det || !sub) return;
      const isChildActive = !!sub.querySelector(`.tab[data-tab="${activeTabId}"]`);
      if (isChildActive) det.open = true;
      section.classList.toggle("is-submenu-open", det.open);
    });
  } finally {
    drawerSyncMuteToggleNav = false;
  }
}

/**
 * Varios submenús pueden quedar abiertos a la vez; al colapsar uno con hijo activo vuelve a la pestaña padre.
 * @param {{ setTab: (id: string) => void } | null} tabsCtl
 */
function initDrawerExpandableSubmenus(tabsCtl) {
  const drawer = document.getElementById("nav-drawer");
  if (!drawer || !tabsCtl) return;

  drawer.querySelectorAll(".drawer-nav-expandable .drawer-nav-details").forEach((det) => {
    det.addEventListener("toggle", () => {
      const section = det.closest(".drawer-nav-expandable");
      const parentTab = section?.getAttribute("data-drawer-parent-tab");
      const sub = section?.querySelector(".drawer-nav-submenu");
      if (!section) return;

      if (!drawerSyncMuteToggleNav) {
        if (!det.open && sub?.querySelector(".tab.is-active") && parentTab) {
          tabsCtl.setTab(parentTab);
        }
      }
      section.classList.toggle("is-submenu-open", det.open);
    });
  });
}

/** Al cambiar de sección, el scroll del documento no se reinicia solo: subir para ver el inicio del panel nuevo. */
function scrollAppMainToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  document.getElementById("contenido-principal")?.scrollTo?.(0, 0);
}

/**
 * @param {(tabId: string) => void} [onTabChange]
 */
function initTabs(onTabChange) {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  let activeTabId = /** @type {string | null} */ (null);

  function setTab(id) {
    const switched = activeTabId !== id;
    activeTabId = id;
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
    if (switched) scrollAppMainToTop();
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

function isGeneralPredictionsComplete(predictions) {
  return predictions?.generalConfirmed === true;
}

function isGroupStagePredictionsComplete(predictions) {
  const confirmed = predictions?.groupOrderConfirmed ?? {};
  return GROUPS.every((grp) => confirmed[grp.id] === true);
}

/**
 * Partidos con equipos/cruce listos y aún editables: falta confirmar predicción del usuario.
 * @param {string} participantId
 * @param {ReturnType<typeof loadOfficialResults>} official
 */
function isPartidosPredictionsCompleteForUser(participantId, official) {
  const pStore = loadPredictions(participantId);
  for (const m of GROUP_MATCHES) {
    const teamsDecided = isQuinielaTeamSlotDecided(m.home) && isQuinielaTeamSlotDecided(m.away);
    if (!teamsDecided) continue;
    const matchStage = official.groupMatchState?.[m.id] ?? "ready";
    const predictionsLocked =
      matchStage !== "ready" || official.groupPredictionsBlockedForAll === true;
    const predCommitted = pStore.groupScoresConfirmed?.[m.id] === true;
    if (!predictionsLocked && !predCommitted) return false;
  }
  const labelScoresKo = allFilledOfficialKnockoutScores(official);
  for (const m of getKnockoutMatchesFlat()) {
    const officialConfirmed = official.knockoutScoresConfirmed?.[m.id] === true;
    const predictionsLocked = officialConfirmed;
    const { ri, mi } = getKoRoundMatchIndex(m.id);
    const koOfficialHome = resolveKnockoutSlotLabel(ri, mi, "home", labelScoresKo);
    const koOfficialAway = resolveKnockoutSlotLabel(ri, mi, "away", labelScoresKo);
    const koOfficialSlotsDecided =
      isQuinielaTeamSlotDecided(koOfficialHome) && isQuinielaTeamSlotDecided(koOfficialAway);
    if (!koOfficialSlotsDecided) continue;
    const predCommitted = pStore.knockoutScoresConfirmed?.[m.id] === true;
    if (!predictionsLocked && !predCommitted) return false;
  }
  return true;
}

function updatePredictionTabsProgress(session, predictions) {
  const gruposTab = /** @type {HTMLButtonElement | null} */ (document.querySelector('.tab[data-tab="grupos"]'));
  const generalesTab = /** @type {HTMLButtonElement | null} */ (document.querySelector('.tab[data-tab="generales"]'));
  const partidosTab = /** @type {HTMLButtonElement | null} */ (document.querySelector('.tab[data-tab="partidos"]'));

  const applyState = (el, isDone) => {
    if (!el) return;
    el.classList.toggle("tab-predictions", !isDone);
    el.classList.toggle("tab-predictions--done", isDone);
  };

  if (!session || !predictions) {
    applyState(gruposTab, false);
    applyState(generalesTab, false);
    applyState(partidosTab, false);
    return;
  }

  const official = loadOfficialResults();
  applyState(gruposTab, isGroupStagePredictionsComplete(predictions));
  applyState(generalesTab, isGeneralPredictionsComplete(predictions));
  applyState(partidosTab, isPartidosPredictionsCompleteForUser(session.participantId, official));
}

function fillParticipantSelect(select) {
  select.innerHTML = "";
  const ordered = [...getParticipants()].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of ordered) {
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

function updateSyncLiveBadge() {
  const wrap = $("#sync-live-badge");
  const textEl = $("#sync-live-text");
  if (!wrap || !textEl) return;
  const on = isRemoteSyncActive();
  wrap.classList.toggle("sync-live-badge--on", on);
  wrap.classList.toggle("sync-live-badge--off", !on);
  textEl.textContent = on
    ? "En vivo · servidor compartido"
    : "Sin servidor (solo este navegador)";
  wrap.title = on
    ? "Lista de participantes, predicciones de todos y resultados oficiales se guardan en el servidor y se actualizan entre dispositivos."
    : "No responde /api. Arranca el backend: npm run dev:all o npm run server junto a Vite, o npm start en producción.";
}

function updateSessionBar(session) {
  updateSyncLiveBadge();
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
  const list = getParticipantsForDisplay().sort((a, b) => a.name.localeCompare(b.name));
  wrap.innerHTML = `<ul class="admin-settings-list" aria-label="Participantes">
    ${list
      .map((p) => {
        const prot = isAdminParticipantId(p.id);
        const pinNote = p.pin ? " · con PIN" : "";
        const hex = escapeHtmlAttr(getParticipantAccentHex(p));
        const hasCustom = hasParticipantCustomAccent(p);
        return `<li class="admin-settings-row">
          <span class="admin-settings-row-meta">
            <strong class="admin-settings-name-trigger" data-participant-id="${escapeHtmlAttr(
              p.id,
            )}" title="Pasa el ratón para elegir color en estadísticas (compartido)">${escapeHtml(p.name)}</strong>
            <span class="muted">${escapeHtml(p.id)}${escapeHtml(pinNote)}</span>
          </span>
          <span class="admin-settings-hue-tools">
            <span class="admin-settings-color-jewel" style="--jewel:${hex}" title="Color actual"></span>
            <button type="button" class="btn btn-sm admin-settings-hue-reset" data-accent-reset="${escapeHtmlAttr(p.id)}" ${
              hasCustom ? "" : "disabled"
            }>Auto</button>
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
  wrap.querySelectorAll("[data-accent-reset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pid = btn.getAttribute("data-accent-reset");
      if (!pid) return;
      setParticipantColor(pid, null);
      const sess = loadSession();
      refreshAll(sess);
      renderAdminSettingsList();
    });
  });
  wrap.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-id");
      if (!id || isAdminParticipantId(id)) return;
      const person = getParticipantById(id);
      if (!person) return;
      if (
        !confirm(
          isRemoteSyncActive()
            ? `¿Eliminar a ${person.name} (${id})? Se borrarán sus predicciones en el servidor para todos.`
            : `¿Eliminar a ${person.name} (${id})? Se borrarán sus predicciones guardadas en este navegador.`,
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
  if (btn) {
    btn.addEventListener("click", () => {
      tabsController?.setTab("reglas");
    });
  }
  document.querySelectorAll("[data-pm26-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      const tab = el.getAttribute("data-pm26-tab");
      if (!tab || !tabsController) return;
      const partidosScope = el.getAttribute("data-pm26-partidos-scope");
      if (tab === "partidos" && partidosScope) {
        try {
          sessionStorage.removeItem(PARTIDOS_NAV_PROXIMOS_SESSION_KEY);
        } catch {
          /* ignore */
        }
        localStorage.setItem(PARTIDOS_SCOPE_KEY, partidosScope);
      }
      tabsController.setTab(tab);
      document.dispatchEvent(new CustomEvent("pm26-nav-drawer-close"));
    });
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

function isGeneralPayloadComplete(general) {
  return ["first", "second", "third", "bestPlayer", "bestGk", "topScorer"].every(
    (k) => String(general?.[k] ?? "").trim() !== "",
  );
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

  const participantScores = [...getParticipantsForDisplay()].map((p) => {
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
    <h2 class="subsection-title group-preds-table-title">Predicciones de todos</h2>
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
function bindGeneralesPointsHelpOverlay() {
  const overlay = $("#overlay-generales-points");
  const closeBtn = $("#generales-points-help-close");
  if (!overlay || !closeBtn) return;
  function close() {
    overlay.hidden = true;
  }
  function open() {
    overlay.hidden = false;
    closeBtn.focus();
  }
  document.body.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-generales-points-help]")) {
      e.preventDefault();
      open();
    }
  });
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || overlay.hidden) return;
    close();
  });
}

function bindGruposOrderHelpOverlay() {
  const overlay = $("#overlay-grupos-order");
  const closeBtn = $("#grupos-order-help-close");
  if (!overlay || !closeBtn) return;
  function close() {
    overlay.hidden = true;
  }
  function open() {
    overlay.hidden = false;
    closeBtn.focus();
  }
  document.body.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-grupos-order-help]")) {
      e.preventDefault();
      open();
    }
  });
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest("[data-grupos-goto-rules-improbable]")) {
      e.preventDefault();
      close();
      tabsController?.setTab("reglas");
      window.setTimeout(() => {
        document.getElementById("reglas-improbable")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || overlay.hidden) return;
    close();
  });
}

function bindPartidosPointsHelpOverlay() {
  const overlay = $("#overlay-partidos-points");
  const closeBtn = $("#partidos-points-help-close");
  if (!overlay || !closeBtn) return;
  function close() {
    overlay.hidden = true;
  }
  function open() {
    overlay.hidden = false;
    closeBtn.focus();
  }
  document.body.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-partidos-points-help]")) {
      e.preventDefault();
      open();
    }
  });
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest("[data-partidos-goto-rules-improbable]")) {
      e.preventDefault();
      close();
      tabsController?.setTab("reglas");
      window.setTimeout(() => {
        document.getElementById("reglas-improbable")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || overlay.hidden) return;
    close();
  });
}

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
  const userGeneralConfirmed = predictions.generalConfirmed === true;
  const official = loadOfficialResults();
  const officialLocked = official.generalOfficialConfirmed === true;
  const isAdmin = canEditOfficialResults(participantId);
  const formDisabled = disabled || officialLocked || generalesPredictionsFormLocked() || userGeneralConfirmed;
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

  const canToggleUserConfirm = !disabled && !officialLocked && !generalesPredictionsFormLocked();
  const isUserGeneralComplete = isGeneralPayloadComplete(g);
  const userConfirmActionsHtml = canToggleUserConfirm
    ? `<div class="group-pred-actions">
        ${
          userGeneralConfirmed
            ? '<button type="button" class="btn btn-sm" data-general-user-action="unconfirm">Desconfirmar predicción</button>'
            : '<button type="button" class="btn btn-primary btn-sm" data-general-user-action="confirm" disabled>Confirmar predicción</button>'
        }
        <span class="pill ${userGeneralConfirmed ? "pill-confirmed" : "pill-locked"}" role="status">${
          userGeneralConfirmed ? "Confirmada" : "Sin confirmar"
        }</span>
      </div>`
    : "";
  form.innerHTML = `${lockBanner}
    ${generalesFullFormInnerHtml(teamOptions, g, formDisabled)}
    ${userConfirmActionsHtml}`;

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
      const payload = readGeneralFormPayload(form);
      savePredictions(participantId, { general: payload, generalConfirmed: false });
      const liveConfirmBtn = /** @type {HTMLButtonElement | null} */ (
        form.querySelector('[data-general-user-action="confirm"]')
      );
      if (liveConfirmBtn) liveConfirmBtn.disabled = !isGeneralPayloadComplete(payload);
      updatePredictionTabsProgress(loadSession(), loadPredictions(participantId));
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

    const confirmBtn = /** @type {HTMLButtonElement | null} */ (
      form.querySelector('[data-general-user-action="confirm"]')
    );
    if (confirmBtn) {
      confirmBtn.disabled = !isUserGeneralComplete;
      confirmBtn.addEventListener("click", () => {
        const payload = readGeneralFormPayload(form);
        if (!isGeneralPayloadComplete(payload)) {
          alert("Completa podio y premios antes de confirmar.");
          return;
        }
        savePredictions(participantId, { general: payload, generalConfirmed: true });
        refreshAll(loadSession());
      });
    }
  }

  const unconfirmBtn = /** @type {HTMLButtonElement | null} */ (
    form.querySelector('[data-general-user-action="unconfirm"]')
  );
  if (unconfirmBtn && canToggleUserConfirm) {
    unconfirmBtn.addEventListener("click", () => {
      savePredictions(participantId, { generalConfirmed: false });
      refreshAll(loadSession());
    });
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
  syncFaseGruposFilterOptions(predictions);
  syncFaseGruposConfirmStatus(predictions);
  const filterEl = $("#fase-grupos-filter");
  const selectedGid = filterEl?.value ?? "";
  if (!selectedGid) {
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = "Elige un grupo para ver tu predicción y la de los demás.";
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
  card.className = "card card--grupos";
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

    card.innerHTML = `<header class="generales-user-pred-header">
      <h2 class="generales-user-pred-title">Tu predicción</h2>
      <p class="generales-user-pred-hint">Ordena los cuatro equipos, marca si el 3.º pasa como mejor tercero y confirma cuando esté listo.</p>
    </header>
    <p class="grupos-card-group-label"><strong>Grupo ${escapeHtml(grp.id)}</strong></p>`;

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

    const thirdChecked = predictions.groupThirdAdvances?.[grp.id] === true;
    if (orderLocked) {
      orderWrap.innerHTML = `<ul class="order-readonly">${order
        .map((t, idx) => {
          const pos = `${idx + 1}°`;
          const thirdBadge =
            idx === 2
              ? `<span class="third-inline-lock ${thirdChecked ? "is-on" : ""}" role="status">${thirdChecked ? "3.º pasa ✓" : "3.º no pasa ✕"}</span>`
              : "";
          const teamCell = t ? teamLabelHtml(t) : '<span class="muted">Sin elegir</span>';
          return `<li class="order-row"><span class="order-pos">${pos}</span><span class="order-readonly__team">${teamCell}</span>${thirdBadge}</li>`;
        })
        .join("")}</ul>`;
      if (groupConfirmed && !orderKickoffLocked) {
        orderWrap.innerHTML += `
          <div class="group-order-actions">
            <button type="button" class="btn btn-sm group-order-unlock" data-group="${grp.id}">Cambiar orden</button>
            <span class="pill pill-confirmed" role="status">Confirmada</span>
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
      const pendingPill = document.createElement("span");
      pendingPill.className = "pill pill-locked";
      pendingPill.setAttribute("role", "status");
      pendingPill.textContent = "Sin confirmar";
      actions.appendChild(pendingPill);
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

/**
 * Por partido con marcador oficial contable: veces sin predicción confirmada,
 * veces empatando el mayor puntaje entre quienes mandaron predicción, y veces siendo el único con ese máximo.
 * @returns {Record<string, { topTie: number, soleTop: number, noPred: number }>}
 */
function computePerParticipantMatchColumnStats() {
  const offScores = getOfficialGroupScoresForLiveQuinielaPoints();
  const officialStore = loadOfficialResults();
  const participants = getParticipantsForDisplay();
  /** @type {Record<string, { topTie: number, soleTop: number, noPred: number }>} */
  const byId = {};
  for (const p of participants) {
    byId[p.id] = { topTie: 0, soleTop: 0, noPred: 0 };
  }

  /**
   * @param {{ id: string, groupId?: string | null, roundId?: string | null }} m
   * @param {{ home: unknown, away: unknown }} off
   * @param {boolean} isKo
   */
  function processMatch(m, off, isKo) {
    const koPenPh = isKo ? knockoutRoundRequiresPenaltyPickOnDraw(m.roundId) : false;
    /** @type {{ id: string, pts: number }[]} */
    const scored = [];
    for (const p of participants) {
      const pStore = loadPredictions(p.id);
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
      const improb = isKo ? getImprobableOutcomeSignForKoMatch(m.id, off) : getImprobableOutcomeSignForMatch(m.id, off);
      const matchScoring = getMatchScoringForQuiniela(m);
      const pts = computeGroupMatchPoints(off, pred, improb, matchScoring, koPenPh);
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
    const off = offScores[m.id];
    if (!off) continue;
    processMatch(m, off, false);
  }
  for (const m of getKnockoutMatchesFlat()) {
    if (officialStore.knockoutScoresConfirmed?.[m.id] !== true) continue;
    const off = officialStore.knockoutScores[m.id];
    if (!off || off.home === "" || off.away === "") continue;
    processMatch(m, off, true);
  }

  return byId;
}

function computeLiveParticipantRows(currentParticipantId) {
  const offScores = getOfficialGroupScoresForLiveQuinielaPoints();
  const officialStore = loadOfficialResults();
  const matchColStats = computePerParticipantMatchColumnStats();
  const liveOfficial = getLiveOfficialGroupSnapshot();
  const officialGen = officialStore.generalOfficial ?? {};
  const hasGeneralOfficial =
    officialStore.generalOfficialConfirmed === true &&
    Boolean(String(officialGen.first ?? "").trim()) &&
    Boolean(String(officialGen.second ?? "").trim()) &&
    Boolean(String(officialGen.third ?? "").trim());

  return getParticipantsForDisplay().map((p) => {
    let total = 0;
    let matchPointsTotal = 0;
    let exact = 0;
    let outcome = 0;
    let zeroPointMatches = 0;
    let matchBonusCount = 0;
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
      const thirdAdvanceHit =
        officialThirdDefined &&
        (predThird === true || predThird === false) &&
        predThird === officialThird;
      if (fullOrderHit && thirdAdvanceHit) groupOrderPerfectCount += 1;
      else if (fullOrderHit) groupOrderExcelenteCount += 1;
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
      matchPointsTotal += pts;
      countedMatches += 1;
      if (pts === 0) zeroPointMatches += 1;
      if (isExactGroupPrediction(off, pred)) exact += 1;
      const breakdown = computeGroupMatchPointsBreakdown(off, pred, improb, matchScoring);
      if (breakdown?.exactTier === "perfecto") matchPerfectCount += 1;
      else if (breakdown?.exactTier === "excelente") matchExcelenteCount += 1;
      else if (breakdown?.exactTier === "bien") matchBienCount += 1;
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
      const koPenPh = knockoutRoundRequiresPenaltyPickOnDraw(m.roundId);
      const pts = computeGroupMatchPoints(off, pred, improb, matchScoring, koPenPh);
      if (pts === null) continue;
      total += pts;
      matchPointsTotal += pts;
      countedMatches += 1;
      if (pts === 0) zeroPointMatches += 1;
      if (isExactGroupPrediction(off, pred)) exact += 1;
      const breakdown = computeGroupMatchPointsBreakdown(off, pred, improb, matchScoring, koPenPh);
      if (breakdown?.exactTier === "perfecto") matchPerfectCount += 1;
      else if (breakdown?.exactTier === "excelente") matchExcelenteCount += 1;
      else if (breakdown?.exactTier === "bien") matchBienCount += 1;
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
      countedMatches,
      avgPtsPerMatch,
      matchTopTieCount: mc.topTie,
      matchSoleTopCount: mc.soleTop,
      matchNoPredCount: mc.noPred,
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
    <thead><tr>
      <th scope="col" class="floating-ranking-th-num">#</th>
      <th scope="col" class="floating-ranking-th-player">Jugador</th>
      <th scope="col" class="floating-ranking-th-pts">Pts</th>
    </tr></thead>
    <tbody>
      ${rows
        .map((r, i) => {
          const podium =
            i === 0 ? "floating-ranking-row--gold" : i === 1 ? "floating-ranking-row--silver" : i === 2 ? "floating-ranking-row--bronze" : "";
          const rowClass = [podium, r.self ? "floating-ranking-row-self" : ""].filter(Boolean).join(" ");
          const you = r.self ? " (tu)" : "";
          return `<tr class="${rowClass}"><td>${i + 1}</td><th scope="row">${escapeHtml(r.p.name)}${you}</th><td><strong>${r.pts}</strong></td></tr>`;
        })
        .join("")}
    </tbody>
  </table>`;
}

function initFloatingRanking() {
  if (floatingRankingReady) return;

  const host = $("#floating-ranking");
  const toggle = $("#floating-ranking-toggle");
  const card = $("#floating-ranking-card");
  const closeBtn = $("#floating-ranking-close");
  const enableBtn = $("#btn-toggle-floating-ranking");
  if (!host || !toggle || !card || !closeBtn) return;
  floatingRankingReady = true;

  let enabled = localStorage.getItem(FLOATING_RANK_ENABLED_KEY) !== "0";

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
    } else if (host.style.left && host.style.top) {
      requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        const p = clampHostPos(rect.left, rect.top);
        if (Math.abs(p.x - rect.left) > 0.5 || Math.abs(p.y - rect.top) > 0.5) {
          applyHostPosPx(p.x, p.y);
          localStorage.setItem(FLOATING_RANK_POS_KEY, JSON.stringify({ x: p.x, y: p.y }));
        }
      });
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
  window.addEventListener("resize", () => {
    updateCardPlacement();
    if (!enabled || host.hidden || !host.style.left || !host.style.top) return;
    const rect = host.getBoundingClientRect();
    const p = clampHostPos(rect.left, rect.top);
    if (Math.abs(p.x - rect.left) > 0.5 || Math.abs(p.y - rect.top) > 0.5) {
      applyHostPosPx(p.x, p.y);
      localStorage.setItem(FLOATING_RANK_POS_KEY, JSON.stringify({ x: p.x, y: p.y }));
    }
  });

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

  /** Sin acotar al viewport, left/top guardados pueden dejar el botón fuera de pantalla. */
  const savedPosRaw = localStorage.getItem(FLOATING_RANK_POS_KEY);
  if (savedPosRaw) {
    try {
      const savedPos = JSON.parse(savedPosRaw);
      if (Number.isFinite(savedPos?.x) && Number.isFinite(savedPos?.y)) {
        const p = clampHostPos(savedPos.x, savedPos.y);
        applyHostPosPx(p.x, p.y);
        if (Math.round(savedPos.x) !== p.x || Math.round(savedPos.y) !== p.y) {
          localStorage.setItem(FLOATING_RANK_POS_KEY, JSON.stringify({ x: p.x, y: p.y }));
        }
      }
    } catch {
      /* ignore invalid saved position */
    }
  }

  setEnabled(enabled, false);
}

function renderFinalRanking(session) {
  const intro = $("#final-ranking-intro");
  const loginHint = $("#final-ranking-intro-login");
  const body = $("#table-final-ranking-body");
  if (!intro || !body) return;
  if (!session) {
    if (loginHint) loginHint.hidden = false;
    body.innerHTML = "";
    return;
  }
  if (loginHint) loginHint.hidden = true;
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
      const podium = i === 0 ? "group-ranking-row--gold" : i === 1 ? "group-ranking-row--silver" : i === 2 ? "group-ranking-row--bronze" : "";
      const rowCls = [podium, r.self ? "row-self" : ""].filter(Boolean).join(" ");
      const you = r.self ? ' <span class="td-muted">(tú)</span>' : "";
      return `<tr class="${rowCls}">
        <td class="group-ranking-rank">${i + 1}</td>
        <th scope="row" class="group-ranking-name">${escapeHtml(r.p.name)}${you}</th>
        ${groupOrderRankingStatCell(
          r.totalBien,
          "BIEN totales (badge unico por prediccion).",
          maxBien > 0 && r.totalBien === maxBien,
          "bien",
        )}
        ${groupOrderRankingStatCell(
          r.totalExcelente,
          "EXCELENTE totales (badge unico por prediccion).",
          maxExcelente > 0 && r.totalExcelente === maxExcelente,
          "excelente",
        )}
        ${groupOrderRankingStatCell(
          r.totalPerfect,
          "PERFECTO totales (badge unico por prediccion).",
          maxPerfect > 0 && r.totalPerfect === maxPerfect,
          "perfecto",
        )}
        ${groupOrderRankingStatCell(
          r.totalBonus,
          "BONUS totales.",
          maxBonus > 0 && r.totalBonus === maxBonus,
          "bonus",
        )}
        <td class="group-ranking-num group-ranking-total ${maxPts > 0 && r.pts === maxPts ? "group-ranking-total--top" : ""}"><strong>${r.pts}</strong></td>
      </tr>`;
    })
    .join("");
}

function playerHeaderStyles(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `color: ${hex}; text-shadow: 0 0 22px rgba(${r},${g},${b},0.58), 0 1px 2px rgba(0, 0, 0, 0.88);`;
}

function playerColumnSurfaceStyle(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `background: rgba(${r},${g},${b},0.2);`;
}

function applyStatsMatrixAccentPreview(participantId, hex) {
  const table = $("#table-aciertos");
  if (!table || !participantId) return;
  const s = String(hex ?? "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(s)) return;
  const h = s.toLowerCase();
  table.querySelectorAll(`[data-participant-id="${CSS.escape(participantId)}"]`).forEach((el) => {
    if (el.tagName === "TH") {
      el.setAttribute("style", playerHeaderStyles(h));
    } else {
      el.setAttribute("style", playerColumnSurfaceStyle(h));
    }
  });
}

const ACCENT_PRESET_HEX = [
  "#ff6b6b",
  "#f06595",
  "#be4bdb",
  "#7950f2",
  "#4c6ef5",
  "#339af0",
  "#15aabf",
  "#12b886",
  "#51cf66",
  "#94d82d",
  "#fab005",
  "#fd7e14",
  "#ffffff",
  "#adb5bd",
];

function bindParticipantAccentPopover() {
  const panel = $("#panel-stats");
  const table = $("#table-aciertos");
  const adminOverlay = $("#overlay-admin-settings");
  const pop = $("#participant-accent-popover");
  const titleEl = $("#participant-accent-title");
  const colorInput = $("#participant-accent-color-input");
  const resetBtn = $("#participant-accent-reset");
  const presetHost = $("#participant-accent-presets");
  if (!panel || !table || !adminOverlay || !pop || !titleEl || !colorInput || !resetBtn || !presetHost) return;
  if (pop.dataset.accentBound === "1") return;
  pop.dataset.accentBound = "1";

  if (!presetHost.dataset.filled) {
    presetHost.dataset.filled = "1";
    for (const hex of ACCENT_PRESET_HEX) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "participant-accent-preset";
      b.dataset.hex = hex;
      b.style.setProperty("--preset-fill", hex);
      b.title = hex;
      presetHost.appendChild(b);
    }
  }

  let hideT = 0;
  /** @type {string | null} */
  let activeParticipantId = null;

  function clearHideTimer() {
    if (hideT) window.clearTimeout(hideT);
    hideT = 0;
  }

  function scheduleHide() {
    clearHideTimer();
    hideT = window.setTimeout(() => {
      pop.hidden = true;
      activeParticipantId = null;
    }, 280);
  }

  function positionPop(anchor) {
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const left = Math.round(Math.min(window.innerWidth - pw - 8, Math.max(8, r.left + r.width / 2 - pw / 2)));
    const top = Math.round(Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 8));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function openForAnchor(anchor, participantId, headingText) {
    clearHideTimer();
    activeParticipantId = participantId;
    const p = getParticipantById(participantId);
    titleEl.textContent = headingText;
    colorInput.value = getParticipantAccentHex(p ?? { id: participantId, name: "", pin: null });
    pop.hidden = false;
    requestAnimationFrame(() => positionPop(anchor));
  }

  function onStatsNameOver(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const th = t.closest("th.stats-matrix-player--self");
    if (!th || !table.contains(th)) return;
    const id = th.getAttribute("data-participant-id");
    if (!id) return;
    openForAnchor(th, id, "Tu color en estadísticas");
  }

  function onStatsNameOut(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const th = t.closest("th.stats-matrix-player--self");
    if (!th) return;
    const rel = e.relatedTarget;
    if (rel instanceof Node && (th.contains(rel) || pop.contains(rel))) return;
    scheduleHide();
  }

  function onAdminNameOver(e) {
    if (adminOverlay.hidden) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const el = t.closest(".admin-settings-name-trigger");
    if (!el || !adminOverlay.contains(el)) return;
    const id = el.getAttribute("data-participant-id");
    if (!id) return;
    const p = getParticipantById(id);
    openForAnchor(el, id, p ? `Color de ${p.name}` : "Color del participante");
  }

  function onAdminNameOut(e) {
    if (adminOverlay.hidden) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    const el = t.closest(".admin-settings-name-trigger");
    if (!el) return;
    const rel = e.relatedTarget;
    if (rel instanceof Node && (el.contains(rel) || pop.contains(rel))) return;
    scheduleHide();
  }

  panel.addEventListener("mouseover", onStatsNameOver, true);
  panel.addEventListener("mouseout", onStatsNameOut, true);
  adminOverlay.addEventListener("mouseover", onAdminNameOver, true);
  adminOverlay.addEventListener("mouseout", onAdminNameOut, true);

  pop.addEventListener("mouseenter", clearHideTimer);
  pop.addEventListener("mouseleave", scheduleHide);

  colorInput.addEventListener("input", () => {
    if (!activeParticipantId) return;
    applyStatsMatrixAccentPreview(activeParticipantId, colorInput.value);
  });

  colorInput.addEventListener("change", () => {
    if (!activeParticipantId) return;
    setParticipantColor(activeParticipantId, colorInput.value);
    dismissStatsColorHint();
    refreshAll(loadSession());
    if (!adminOverlay.hidden) renderAdminSettingsList();
    const anchor =
      table.querySelector(`[data-participant-id="${CSS.escape(activeParticipantId)}"]`) ??
      adminOverlay.querySelector(`.admin-settings-name-trigger[data-participant-id="${CSS.escape(activeParticipantId)}"]`);
    if (anchor) requestAnimationFrame(() => positionPop(anchor));
  });

  presetHost.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest(".participant-accent-preset");
    if (!btn || !presetHost.contains(btn)) return;
    const hex = btn.getAttribute("data-hex");
    if (!hex || !activeParticipantId) return;
    colorInput.value = hex;
    applyStatsMatrixAccentPreview(activeParticipantId, hex);
    setParticipantColor(activeParticipantId, hex);
    dismissStatsColorHint();
    refreshAll(loadSession());
    if (!adminOverlay.hidden) renderAdminSettingsList();
    const anchor =
      table.querySelector(`th[data-participant-id="${CSS.escape(activeParticipantId)}"]`) ??
      adminOverlay.querySelector(`.admin-settings-name-trigger[data-participant-id="${CSS.escape(activeParticipantId)}"]`);
    if (anchor) requestAnimationFrame(() => positionPop(anchor));
  });

  resetBtn.addEventListener("click", () => {
    const id = activeParticipantId ?? loadSession()?.participantId;
    if (!id) return;
    setParticipantColor(id, null);
    dismissStatsColorHint();
    refreshAll(loadSession());
    if (!adminOverlay.hidden) renderAdminSettingsList();
    const p = getParticipantById(id);
    colorInput.value = getParticipantAccentHex(p ?? { id, name: "", pin: null });
    const anchor =
      table.querySelector(`[data-participant-id="${CSS.escape(id)}"]`) ??
      adminOverlay.querySelector(`.admin-settings-name-trigger[data-participant-id="${CSS.escape(id)}"]`);
    if (anchor && !pop.hidden) requestAnimationFrame(() => positionPop(anchor));
  });
}

function renderStats(session) {
  const loginHint = $("#stats-intro-login");
  const acHead = $("#table-aciertos-head");
  const acBody = $("#table-aciertos-body");
  const podium = $("#stats-podium");

  if (!session || !podium) {
    if (loginHint) loginHint.hidden = false;
    if (acHead) acHead.innerHTML = "";
    if (acBody) acBody.innerHTML = "";
    if (podium) podium.innerHTML = "";
    return;
  }

  if (loginHint) loginHint.hidden = true;

  const rows = computeLiveParticipantRows(session.participantId);
  const byPoints = [...rows].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.totalPerfect !== a.totalPerfect) return b.totalPerfect - a.totalPerfect;
    return a.p.name.localeCompare(b.p.name);
  });
  const showStatsColorHint = !isStatsColorHintDismissed();

  const top3 = byPoints.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const podiumOrder = [1, 0, 2].filter((i) => top3[i]);
  podium.innerHTML = `<div class="stats-podium-grid">${podiumOrder
    .map((idx) => {
      const r = top3[idx];
      const pos = idx + 1;
      const you = r.self ? ' <span class="stats-podium-you">(tú)</span>' : "";
      const hue = getParticipantDisplayHue(r.p);
      return `<div class="stats-podium-slot stats-podium-slot--p${pos}">
        <article class="stats-podium-card stats-podium-card--p${pos}" style="--podium-accent-h: ${hue}; --podium-order: ${pos};">
          <div class="stats-podium-medal-wrap">
            <span class="stats-podium-medal">${medals[idx]}</span>
            <span class="stats-podium-rank-badge">#${pos}</span>
          </div>
          <div class="stats-podium-nameplate" data-podium-nameplate>
            <h3 class="stats-podium-name">${escapeHtml(r.p.name)}${you}</h3>
            <p class="stats-podium-points">${r.pts} pts</p>
          </div>
        </article>
        <div class="stats-podium-pillar stats-podium-pillar--p${pos}">
          <span class="stats-podium-place">${pos}</span>
        </div>
      </div>`;
    })
    .join("")}</div>`;
  animateStatsPodium(podium);

  const acSorted = [...rows].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.totalPerfect !== a.totalPerfect) return b.totalPerfect - a.totalPerfect;
    if (b.totalBonus !== a.totalBonus) return b.totalBonus - a.totalBonus;
    return a.p.name.localeCompare(b.p.name);
  });

  if (!acHead || !acBody) return;

  if (acSorted.length === 0) {
    acHead.innerHTML = "";
    acBody.innerHTML = "";
    return;
  }

  const selfIdx = acSorted.findIndex((r) => r.self);
  const hintRow =
    showStatsColorHint && selfIdx >= 0
      ? `<tr class="stats-color-hint-row" aria-hidden="true">` +
        `<th class="stats-color-hint-cell stats-color-hint-cell--empty"></th>` +
        acSorted
          .map((_, idx) =>
            idx === selfIdx
              ? '<th class="stats-color-hint-cell stats-color-hint-cell--active"><span class="stats-color-hint-badge" role="status" aria-live="polite">CAMBIA TU COLOR</span></th>'
              : '<th class="stats-color-hint-cell stats-color-hint-cell--empty"></th>',
          )
          .join("") +
        `</tr>`
      : "";

  const headRow =
    hintRow +
    `<tr>` +
    `<th scope="col" class="stats-matrix-corner">Métrica</th>` +
    acSorted
      .map((r) => {
        const hex = getParticipantAccentHex(r.p);
        const selfCls = r.self ? " stats-matrix-player--self" : "";
        const you = r.self ? ' <span class="td-muted">(tú)</span>' : "";
        const selfTitle = r.self
          ? ' title="Pasa el ratón para elegir color (paleta; se guarda para todos)"'
          : "";
        return `<th scope="col" class="stats-matrix-player${selfCls}" data-participant-id="${escapeHtmlAttr(r.p.id)}"${selfTitle} style="${playerHeaderStyles(hex)}">${escapeHtml(r.p.name)}${you}</th>`;
      })
      .join("") +
    `</tr>`;
  acHead.innerHTML = headRow;

  const metricRows = [
    {
      label: "Cant. de veces con 0 puntos",
      title: "Partidos con marcador oficial ya contable en los que tu predicción confirmada sumó 0 puntos.",
      higherIsBetter: false,
      value: (r) => r.zeroPointMatches,
      format: (n) => String(n),
    },
    {
      label: "Cant. de veces con puntaje más alto",
      title:
        "Partidos en los que tu puntaje empató el máximo entre todos los participantes que enviaron predicción confirmada para ese partido.",
      higherIsBetter: true,
      value: (r) => r.matchTopTieCount,
      format: (n) => String(n),
    },
    {
      label: "Cant. de veces con puntaje más alto siendo el único",
      title: "Partidos en los que fuiste el único con el puntaje más alto entre quienes mandaron predicción confirmada.",
      higherIsBetter: true,
      value: (r) => r.matchSoleTopCount,
      format: (n) => String(n),
    },
    {
      label: "Cant. de veces sin mandar predicción",
      title:
        "Partidos con marcador oficial ya contable en los que no tenías predicción confirmada (no participaste en ese partido para la quiniela).",
      higherIsBetter: false,
      value: (r) => r.matchNoPredCount,
      format: (n) => String(n),
    },
    {
      label: "Promedio de puntos",
      title: "Media de puntos solo en partidos con tu predicción confirmada y puntaje ya contabilizado.",
      higherIsBetter: true,
      floatCompare: true,
      value: (r) => r.avgPtsPerMatch,
      format: (n) => n.toFixed(2),
    },
  ];

  acBody.innerHTML = metricRows
    .map((m) => {
      const rawVals = acSorted.map((r) => m.value(r));
      let bestFlags;
      if (m.higherIsBetter) {
        const max = Math.max(...rawVals);
        bestFlags = rawVals.map((v) => {
          if (m.floatCompare) {
            return max > 0 && Math.abs(v - max) < 1e-9;
          }
          return max > 0 && v === max;
        });
      } else {
        const min = Math.min(...rawVals);
        bestFlags = rawVals.map((v) => v === min);
      }

      return (
        `<tr>` +
        `<th scope="row" class="stats-matrix-metric" title="${escapeHtml(m.title)}">${escapeHtml(m.label)}</th>` +
        acSorted
          .map((r, i) => {
            const raw = m.value(r);
            const display = m.format(raw);
            const hex = getParticipantAccentHex(r.p);
            const isBest = bestFlags[i];
            const selfCls = r.self ? " stats-matrix-cell--self" : "";
            const bestCls = isBest ? " stats-matrix-cell--best" : "";
            return `<td class="stats-matrix-cell${selfCls}${bestCls}" data-participant-id="${escapeHtmlAttr(r.p.id)}" style="${playerColumnSurfaceStyle(hex)}"><span class="stats-matrix-val">${display}</span></td>`;
          })
          .join("") +
        `</tr>`
      );
    })
    .join("");
}

function animateStatsPodium(root) {
  if (!root) return;
  const slots = root.querySelectorAll(".stats-podium-slot");
  const nameplates = root.querySelectorAll("[data-podium-nameplate]");
  if (!slots.length) return;

  animate(slots, {
    y: [24, 0],
    opacity: [0, 1],
    scale: [0.96, 1],
    duration: 700,
    delay: stagger(90, { start: 60 }),
    ease: "out(4)",
  });

  animate(nameplates, {
    boxShadow: [
      "0 0 0 rgba(0,0,0,0)",
      "0 14px 26px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -10px 16px rgba(0,0,0,0.24)",
    ],
    duration: 850,
    delay: stagger(110, { start: 220 }),
    ease: "out(3)",
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeHtmlAttr(s) {
  return escapeHtml(s).replaceAll("'", "&#39;");
}

function allMatchesForPartidosCalendar() {
  return [...GROUP_MATCHES, ...getKnockoutMatchesFlat()];
}

/**
 * Partidos «próxima jornada» (resaltados en amarillo) sin predicción confirmada por el participante.
 * Cuenta todos los IDs en amarillo, tengan o no equipos/cruces ya definidos.
 * @param {string} participantId
 * @param {Set<string>} nextHighlightIds
 */
function countPendingProximosForUser(participantId, nextHighlightIds) {
  if (nextHighlightIds.size === 0) return 0;
  const pStore = loadPredictions(participantId);
  const byId = new Map(allMatchesForPartidosCalendar().map((m) => [m.id, m]));
  let n = 0;
  for (const id of nextHighlightIds) {
    const m = byId.get(id);
    if (!m) continue;
    if (m.groupId != null) {
      if (pStore.groupScoresConfirmed?.[id] === true) continue;
      n++;
    } else if (m.roundId != null) {
      if (pStore.knockoutScoresConfirmed?.[id] === true) continue;
      n++;
    }
  }
  return n;
}

/**
 * Mínimo de días (calendario local) hasta el kickoff entre partidos de la jornada próxima
 * que el usuario aún no tiene confirmados.
 * @param {string} participantId
 * @param {Set<string>} nextHighlightIds
 * @returns {number | null}
 */
function minDaysUntilKickoffForPendingProximos(participantId, nextHighlightIds) {
  if (nextHighlightIds.size === 0) return null;
  const pStore = loadPredictions(participantId);
  const byId = new Map(allMatchesForPartidosCalendar().map((m) => [m.id, m]));
  let minD = Infinity;
  for (const id of nextHighlightIds) {
    const m = byId.get(id);
    if (!m?.kickoff) continue;
    if (m.groupId != null) {
      if (pStore.groupScoresConfirmed?.[id] === true) continue;
    } else if (m.roundId != null) {
      if (pStore.knockoutScoresConfirmed?.[id] === true) continue;
    } else continue;
    const d = daysUntilKickoffLocal(m.kickoff);
    if (d !== null && d < minD) minD = d;
  }
  return Number.isFinite(minD) ? minD : null;
}

/** Texto entre paréntesis: cierre de predicciones según días hasta el primer kickoff pendiente. */
function bannerCloseDaysParen(minDays, pendingCount) {
  if (minDays === null) return null;
  const verb = pendingCount === 1 ? "cierra" : "cierran";
  if (minDays <= 0) return `(${verb} hoy)`;
  if (minDays === 1) return `(${verb} en 1 día)`;
  return `(${verb} en ${minDays} días)`;
}

function partidosSiguientesVistaActiva() {
  try {
    return sessionStorage.getItem(PARTIDOS_NAV_PROXIMOS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Fase/torneo real (grupos, all-ko, r32…), independiente del ítem decorativo «SIGUIENTES PARTIDOS». */
function getPartidosUnderlyingScope() {
  return localStorage.getItem(PARTIDOS_SCOPE_KEY) ?? "grupos";
}

/** Filtro Grupo solo en fase de grupos y con listado completo (no en «SIGUIENTES PARTIDOS» ni shortcut). */
function shouldShowPartidosGroupToolbar() {
  return getPartidosUnderlyingScope() === "grupos" && !partidosSiguientesVistaActiva();
}

function syncPartidosScopeSelectUi() {
  const sel = $("#partidos-scope-filter");
  if (!sel) return;
  const underlying = getPartidosUnderlyingScope();
  if (partidosSiguientesVistaActiva()) {
    if ([...sel.options].some((o) => o.value === PARTIDOS_VISTA_SIGUIENTES_VALUE)) {
      sel.value = PARTIDOS_VISTA_SIGUIENTES_VALUE;
    }
  } else if ([...sel.options].some((o) => o.value === underlying)) {
    sel.value = underlying;
  }
  sel.classList.toggle("partidos-scope-filter--siguientes", partidosSiguientesVistaActiva());
}

/**
 * @param {{ participantId: string } | null} session
 */
function updateProximosNavShortcutButton(session) {
  const banner = /** @type {HTMLButtonElement | null} */ (document.getElementById("nav-drawer-pending-banner"));
  const btnTitle =
    "Abre Partidos mostrando solo la jornada próxima (amarilla). Al cambiar Vista vuelves al listado completo.";

  /**
   * @param {string} mainText
   * @param {string} variantClass
   * @param {string} extraClass
   * @param {boolean} showTapHint
   * @param {{ parenText?: string | null, tapPlural?: boolean, tapText?: string | null }} [opts]
   */
  const setBannerLines = (mainText, variantClass, extraClass, showTapHint, opts = {}) => {
    if (!banner) return;
    const parenText = opts.parenText ?? null;
    const tapPlural = opts.tapPlural !== false;
    const tapPhrase = opts.tapText ?? (tapPlural ? "Toca para ir a verlos" : "Toca para ir a verlo");
    const tap =
      showTapHint === true
        ? `<span class="nav-drawer-pending-banner__hint">${escapeHtml(tapPhrase)}</span>`
        : "";
    const mainInner =
      parenText != null && parenText !== ""
        ? `${escapeHtml(mainText)} <span class="nav-drawer-pending-banner__paren">${escapeHtml(parenText)}</span>`
        : escapeHtml(mainText);
    banner.innerHTML = `<span class="nav-drawer-pending-banner__main">${mainInner}</span>${tap}`;
    banner.className = ["nav-drawer-pending-banner", variantClass, extraClass].filter(Boolean).join(" ");
    const ariaMain = parenText != null && parenText !== "" ? `${mainText} ${parenText}` : mainText;
    banner.setAttribute("aria-label", showTapHint === true ? `${ariaMain}. ${tapPhrase}` : ariaMain);
  };

  const clearBanner = () => {
    if (!banner) return;
    banner.hidden = true;
    banner.innerHTML = "";
    banner.className = "nav-drawer-pending-banner";
    banner.disabled = true;
    banner.title = "";
    banner.removeAttribute("aria-label");
  };

  if (!session) {
    clearBanner();
    return;
  }

  const official = loadOfficialResults();
  const nextIds = getNextMatchDayHighlightIds(official, allMatchesForPartidosCalendar());

  if (nextIds.size === 0) {
    if (banner) {
      banner.hidden = false;
      setBannerLines("Sin jornada próxima en el calendario", "nav-drawer-pending-banner--muted", "", false);
      banner.disabled = true;
      banner.title = "No hay partidos destacados como próxima jornada.";
    }
    return;
  }

  const pending = countPendingProximosForUser(session.participantId, nextIds);
  const minDays = minDaysUntilKickoffForPendingProximos(session.participantId, nextIds);
  const closeParen = pending > 0 ? bannerCloseDaysParen(minDays, pending) : null;

  if (banner) {
    banner.hidden = false;
    banner.disabled = false;
    banner.title = btnTitle;
    if (pending <= 0) {
      setBannerLines("Las predicciones de la última fecha al día", "nav-drawer-pending-banner--ok", "", true, {
        tapText: "Toca para ir a verlas",
      });
    } else if (pending === 1) {
      setBannerLines("Falta 1 partido por predecir", "nav-drawer-pending-banner--warn", "nav-drawer-pending-banner--pulse", true, {
        parenText: closeParen,
        tapPlural: false,
      });
    } else {
      setBannerLines(`Faltan ${pending} partidos por predecir`, "nav-drawer-pending-banner--warn", "nav-drawer-pending-banner--pulse", true, {
        parenText: closeParen,
      });
    }
  }
}

/**
 * @param {boolean} confirmed
 * @param {"corner"|"inline"} variant corner = columna derecha con fecha (compacta); inline = sin kickoff
 * @param {boolean} [matchOfficiallyClosed] si true, sustituye confirmada/sin confirmar por «Partido terminado»
 */
function partidosUserPredPillHtml(confirmed, variant, matchOfficiallyClosed = false) {
  const place = variant === "corner" ? "partidos-user-pred-pill--corner" : "partidos-user-pred-pill--inline";
  if (matchOfficiallyClosed) {
    return `<span class="partidos-user-pred-pill partidos-user-pred-pill--ended ${place}" role="status">${escapeHtml("Partido terminado")}</span>`;
  }
  const tone = confirmed ? "partidos-user-pred-pill--ok" : "partidos-user-pred-pill--warn";
  const label = confirmed ? "Predicción confirmada" : "Predicción sin confirmar";
  return `<span class="partidos-user-pred-pill ${tone} ${place}" role="status">${escapeHtml(label)}</span>`;
}

/**
 * Columna superior derecha: fecha, jornada próxima y pastilla de predicción (compacta, sin hueco al pie).
 * @param {{ kickoff?: string | null, id: string }} m
 * @param {Set<string>} nextJornadaIds ids de `getNextMatchDayHighlightIds`
 * @param {boolean} userPredConfirmed
 * @param {boolean} matchOfficiallyClosed
 * @param {boolean} [matchInProgress] admin marcó el partido como iniciado (grupos) o marcador KO sin confirmar
 */
function partidosMatchCornerHtml(m, nextJornadaIds, userPredConfirmed, matchOfficiallyClosed, matchInProgress = false) {
  if (!m.kickoff) return "";
  const isJornadaProxima = nextJornadaIds.has(m.id);
  const dateS = formatKickoffShortSpanish(m.kickoff);
  const eta = countdownLabelSpanish(m.kickoff);
  const meta = `<div class="partidos-match-corner__meta">
    <div class="partidos-match-corner__date-line">${escapeHtml(dateS)}</div>
    <div class="partidos-match-corner__eta">${escapeHtml(eta)}</div>
  </div>`;
  const badge = matchInProgress
    ? `<span class="partidos-corner-badge partidos-corner-badge--en-juego" role="status">EN JUEGO</span>`
    : isJornadaProxima
      ? `<span class="partidos-corner-badge" role="status">${escapeHtml("SIGUIENTE PARTIDO")}</span>`
      : "";
  const predHtml = partidosUserPredPillHtml(userPredConfirmed, "corner", matchOfficiallyClosed);
  return `<aside class="partidos-match-corner" aria-label="Fecha, jornada y estado de tu predicción">
    <div class="partidos-match-corner__stack">
      <div class="partidos-match-corner__row">
        ${meta}
        ${badge}
      </div>
      <div class="partidos-match-corner__pred">${predHtml}</div>
    </div>
  </aside>`;
}

/** @param {{ kickoff?: string | null }} m */
function partidosAccNoKickoffHintHtml(m) {
  if (m.kickoff) return "";
  return `<p class="partidos-acc__no-kick muted" role="note">Sin fecha de inicio</p>`;
}

/**
 * @param {typeof GROUP_MATCHES[number]} m
 * @param {ReturnType<typeof loadOfficialResults>} official
 */
function partidosOfficialPreviewLineGroup(m, official) {
  const off = official.groupScores[m.id] ?? { home: "", away: "" };
  const matchStage = official.groupMatchState?.[m.id] ?? "ready";
  const officialConfirmed = matchStage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
  const bothFilled = off.home !== "" && off.away !== "";
  if (officialConfirmed && bothFilled) {
    return `Resultado oficial: <strong>${escapeHtml(String(off.home))} — ${escapeHtml(String(off.away))}</strong>`;
  }
  if (matchStage === "started" && bothFilled) {
    return `En juego: <strong>${escapeHtml(String(off.home))} — ${escapeHtml(String(off.away))}</strong> <span class="muted">(provisional)</span>`;
  }
  return `<span class="muted">Resultado oficial: pendiente</span>`;
}

/**
 * @param {ReturnType<typeof getKnockoutMatchesFlat>[number]} m
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {boolean} officialSlotsDecided
 */
function partidosOfficialPreviewLineKo(m, official, officialSlotsDecided) {
  const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
  const offOk = official.knockoutScoresConfirmed?.[m.id] === true;
  if (offOk && off.home !== "" && off.away !== "") {
    let line = `Resultado oficial: <strong>${escapeHtml(String(off.home))} — ${escapeHtml(String(off.away))}</strong>`;
    if (knockoutRoundRequiresPenaltyPickOnDraw(m.roundId) && isKnockoutScoreDrawNumbers(off.home, off.away)) {
      const pw = off.penaltyWinner;
      if (pw === "home" || pw === "away") {
        const { ri, mi } = getKoRoundMatchIndex(m.id);
        const lab = allFilledOfficialKnockoutScores(official);
        const hn = resolveKnockoutSlotLabel(ri, mi, "home", lab);
        const an = resolveKnockoutSlotLabel(ri, mi, "away", lab);
        const nm = pw === "home" ? hn : an;
        line += ` <span class="muted">(penales: ${escapeHtml(nm)})</span>`;
      }
    }
    return line;
  }
  if (!officialSlotsDecided) {
    return `<span class="muted">Equipos por definir — oficial pendiente</span>`;
  }
  if (off.home !== "" && off.away !== "") {
    return `Marcador cargado: <strong>${escapeHtml(String(off.home))} — ${escapeHtml(String(off.away))}</strong> <span class="muted">(sin confirmar)</span>`;
  }
  return `<span class="muted">Resultado oficial: pendiente</span>`;
}

/**
 * @param {ReturnType<typeof loadPredictions>} pStore
 * @param {{ id: string, groupId?: string, roundId?: string }} m
 */
function isUserPredictionConfirmedStore(pStore, m) {
  if (m.groupId != null) return pStore.groupScoresConfirmed?.[m.id] === true;
  if (m.roundId != null) return pStore.knockoutScoresConfirmed?.[m.id] === true;
  return false;
}

/**
 * Primero los partidos de la jornada «SIGUIENTES» (`nextJornadaIds`); luego el resto. En cada bloque, por kickoff.
 * Así un partido reiniciado que vuelve a ser «siguiente» no cae al final por haber confirmado predicción en otros.
 * @param {Array<{ id: string, kickoff?: string | null }>} list
 * @param {Set<string>} nextJornadaIds
 */
function sortPartidosBySiguientesThenKickoff(list, nextJornadaIds) {
  return [...list].sort((a, b) => {
    const ia = nextJornadaIds.has(a.id) ? 0 : 1;
    const ib = nextJornadaIds.has(b.id) ? 0 : 1;
    if (ia !== ib) return ia - ib;
    const ta = a.kickoff ? Date.parse(a.kickoff) : Number.POSITIVE_INFINITY;
    const tb = b.kickoff ? Date.parse(b.kickoff) : Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * @param {string|number} homeVal
 * @param {string|number} awayVal
 * @param {"home"|"away"} side
 * @returns {string}
 */
function officialScoreOutcomeClass(homeVal, awayVal, side) {
  const h = Number(String(homeVal).trim());
  const a = Number(String(awayVal).trim());
  if (!Number.isFinite(h) || !Number.isFinite(a)) return "";
  if (h === a) return " quiniela-cell--score-draw";
  if (side === "home") return h > a ? " quiniela-cell--score-win" : " quiniela-cell--score-loss";
  return a > h ? " quiniela-cell--score-win" : " quiniela-cell--score-loss";
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
  const variant = bonus ? "bonus" : "green";
  return `<span class="${cls}"${safeTitle}><canvas class="group-preds-pt-badge__canvas" aria-hidden="true" data-variant="${variant}"></canvas><span class="group-preds-pt-badge__txt">+${points}</span></span>`;
}

/** Marcador / goles en texto plano (sin HTML): envolver para tipografía grande sin afectar badges +N. */
function quinielaCellMainNumWrap(innerHtml) {
  if (typeof innerHtml !== "string" || innerHtml.includes("<")) return innerHtml;
  return `<span class="quiniela-cell-score-num">${innerHtml}</span>`;
}

function quinielaCellWithBadges(innerHtml, badgesHtml) {
  const main = quinielaCellMainNumWrap(innerHtml);
  if (!badgesHtml) return main;
  return `<div class="quiniela-cell-badges-wrap"><div class="quiniela-cell-badges-main">${main}</div>${badgesHtml}</div>`;
}

function quinielaGanadorPickLabel(m, pred) {
  const s = predictionOutcomeSign(pred);
  if (!s) return '<span class="muted">—</span>';
  if (s === "h") return `<span class="quiniela-ganador-name">${escapeHtml(m.home)}</span>`;
  if (s === "a") return `<span class="quiniela-ganador-name">${escapeHtml(m.away)}</span>`;
  return '<span class="quiniela-ganador-draw">Empate</span>';
}

function isKnockoutScoreDrawNumbers(homeVal, awayVal) {
  const h = typeof homeVal === "number" ? homeVal : parseInt(String(homeVal), 10);
  const a = typeof awayVal === "number" ? awayVal : parseInt(String(awayVal), 10);
  return Number.isFinite(h) && Number.isFinite(a) && h === a;
}

/**
 * Columna «Ganador» en eliminatoria: empate + ganador en penales (misma celda).
 * @param {{ home: string, away: string }} vm equipos resueltos para la fila
 * @param {{ home: unknown, away: unknown, penaltyWinner?: string }} pred
 */
function quinielaKoGanadorCellHtml(vm, pred, roundId, opts = {}) {
  const { hideDraft = false, selfEditing = false, matchId = "", targetParticipantId = "" } = opts;
  if (hideDraft) return '<span class="muted">—</span>';
  const s = predictionOutcomeSign(pred);
  if (!s) return '<span class="muted">—</span>';
  let main;
  if (s === "h") main = `<span class="quiniela-ganador-name">${escapeHtml(vm.home)}</span>`;
  else if (s === "a") main = `<span class="quiniela-ganador-name">${escapeHtml(vm.away)}</span>`;
  else main = '<span class="quiniela-ganador-draw">Empate</span>';

  const penPhase = knockoutRoundRequiresPenaltyPickOnDraw(roundId);
  if (!penPhase || s !== "d") return main;

  if (selfEditing && matchId) {
    const cur = pred.penaltyWinner === "home" || pred.penaltyWinner === "away" ? pred.penaltyWinner : "";
    const hCls = cur === "home" ? " btn-primary" : "";
    const aCls = cur === "away" ? " btn-primary" : "";
    return `<div class="ko-ganador-stack">
      <div class="ko-ganador-stack__main">${main}</div>
      <div class="ko-penalty-pick-actions" role="group" aria-label="Ganador en penales">
        <span class="ko-penalty-pick-actions__l muted">Penales</span>
        <button type="button" class="btn btn-sm ko-user-pen-pick${hCls}" data-kid-pen="${escapeHtml(matchId)}" data-pid="${escapeHtml(targetParticipantId)}" data-pen-pick="home">${escapeHtml(vm.home)}</button>
        <button type="button" class="btn btn-sm ko-user-pen-pick${aCls}" data-kid-pen="${escapeHtml(matchId)}" data-pid="${escapeHtml(targetParticipantId)}" data-pen-pick="away">${escapeHtml(vm.away)}</button>
      </div>
    </div>`;
  }

  const pw = pred.penaltyWinner;
  if (pw !== "home" && pw !== "away") {
    return `${main}<div class="ko-pen-pick-inline muted">Penales: —</div>`;
  }
  const nm = pw === "home" ? vm.home : vm.away;
  return `${main}<div class="ko-pen-pick-inline">Penales: <span class="quiniela-ganador-name">${escapeHtml(nm)}</span></div>`;
}

/**
 * Badges sin puntaje extra (BIEN / EXCELENTE) por acierto de resultado y goles parciales.
 * Reglas: en **FASE DE GRUPOS** siempre; en **ELIMINATORIAS** solo si el resultado oficial NO es empate.
 * Prioridad respecto a PERFECTO por marcador: esta función solo aplica cuando no hay marcador exacto (el llamador comprueba).
 * @param {{ outcomePts?: number, homeGoalsPts?: number, awayGoalsPts?: number } | null | undefined} breakdown
 * @param {{ apply: boolean }} opts
 * @returns {"bien"|"excelente"|null}
 */
function quinielaComboBadgeNoPointsTier(breakdown, opts) {
  if (!opts.apply || !breakdown) return null;
  const out = (breakdown.outcomePts ?? 0) > 0;
  const h = (breakdown.homeGoalsPts ?? 0) > 0;
  const a = (breakdown.awayGoalsPts ?? 0) > 0;
  const oneGoal = (h && !a) || (!h && a);
  if (out && oneGoal) return "excelente";
  if (out && !h && !a) return "bien";
  if (!out && oneGoal) return "bien";
  return null;
}

/** HTML de badge sin puntos (BIEN o EXCELENTE) bajo el nombre del participante en quiniela. */
function quinielaNoPointsTierExtraHtml(tier) {
  if (tier === "excelente") {
    return `<div class="quiniela-perfect-inline" role="status" aria-label="Ganador o empate y goles de un solo equipo"><span class="quiniela-perfect-label quiniela-perfect-label--excelente">Excelente</span></div>`;
  }
  if (tier === "bien") {
    return `<div class="quiniela-perfect-inline" role="status" aria-label="Badge sin puntaje extra"><span class="group-preds-bien-label">Bien</span></div>`;
  }
  return "";
}

/**
 * Canvas de fondo animado (chroma-js) para 1.ª celda fila líder: bonus arcoíris o tier bien/excelente/perfect/badge.
 * @param {string} rowClassString clases del `<tr>`
 */
function quinielaLeadRowGradientCanvasHtml(rowClassString) {
  if (rowClassString.includes("quiniela-pred-row--lead-perfect-bonus")) {
    return '<canvas class="quiniela-perfect-bonus-gradient-canvas" aria-hidden="true"></canvas>';
  }
  if (rowClassString.includes("quiniela-pred-row--lead-bien")) {
    return '<canvas class="quiniela-lead-tier-gradient-canvas" data-pm26-lead-tier="bien" aria-hidden="true"></canvas>';
  }
  if (rowClassString.includes("quiniela-pred-row--lead-badge")) {
    return '<canvas class="quiniela-lead-tier-gradient-canvas" data-pm26-lead-tier="badge" aria-hidden="true"></canvas>';
  }
  if (rowClassString.includes("quiniela-pred-row--lead-excelente")) {
    return '<canvas class="quiniela-lead-tier-gradient-canvas" data-pm26-lead-tier="excelente" aria-hidden="true"></canvas>';
  }
  if (
    rowClassString.includes("quiniela-pred-row--lead-perfect") &&
    !rowClassString.includes("quiniela-pred-row--lead-perfect-bonus")
  ) {
    return '<canvas class="quiniela-lead-tier-gradient-canvas" data-pm26-lead-tier="perfect" aria-hidden="true"></canvas>';
  }
  return "";
}

/**
 * Primera celda (participante). Incluye canvas para filas líder con gradiente animado (chroma-js).
 * @param {string} rowClassString clases del `<tr>` (p. ej. `quiniela-pred-row--lead-perfect-bonus`)
 */
function quinielaParticipantFirstTdHtml(name, selfNote, tierExtra, rowClassString) {
  const canvas = quinielaLeadRowGradientCanvasHtml(rowClassString);
  return `<td>${canvas}<div class="quiniela-participant-cell"><div class="quiniela-participant-line">${escapeHtml(name)}${selfNote}</div>${tierExtra}</div></td>`;
}

/**
 * Filas HTML del tbody de predicciones de un partido (quiniela).
 * @param {typeof GROUP_MATCHES[number]} m
 * @param {{ participantId: string }} session
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {boolean} isAdmin
 */
function buildQuinielaPredRowsHtml(m, session, official, isAdmin) {
  const canEditAll = canEditAllParticipantsPredictions(session.participantId);
  const matchScoring = getMatchScoringForQuiniela(m);
  const teamsDecided = isQuinielaTeamSlotDecided(m.home) && isQuinielaTeamSlotDecided(m.away);
  const off = official.groupScores[m.id] ?? { home: "", away: "" };
  const matchStage = official.groupMatchState?.[m.id] ?? "ready";
  const officialConfirmed = matchStage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
  const bothFilled = off.home !== "" && off.away !== "";
  const officialCompleteForScoring = bothFilled && (matchStage === "started" || officialConfirmed);
  const predictionsLocked = matchStage !== "ready" || official.groupPredictionsBlockedForAll === true;
  /** Tras iniciar el partido la última columna muestra Pts; antes solo acciones (confirmar/cambiar). */
  const showPtsColumn = matchStage !== "ready";

  const preliminary = [...getParticipantsForDisplay()]
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
    const exactTier = breakdown?.exactTier ?? null;
    const exact =
      breakdown && r.predCommitted ? isExactGroupPrediction(off, r.pred) : false;
    return { ...r, pts, breakdown, exact, exactTier };
  });

  const scoredPts = rows.filter(
    (d) => officialCompleteForScoring && d.predCommitted && d.pts !== null,
  );
  const maxPtsThisMatch = scoredPts.length ? Math.max(...scoredPts.map((d) => d.pts)) : 0;

  return rows
    .map((d) => {
      let cls = "quiniela-pred-row";
      if (d.p.id === session.participantId) cls += " quiniela-pred-row--self";
      if (showPtsColumn) {
        cls += quinielaPredRowLeadExtraClasses(d, {
          officialCompleteForScoring,
          maxPtsThisMatch,
          comboApply: true,
        });
      }

      const isSelf = d.p.id === session.participantId;
      const rowEditableByActor = (isSelf || canEditAll) && !predictionsLocked && !d.predCommitted && teamsDecided;
      /** Borrador no confirmado: otros no ven marcador ni ganador hasta «Confirmar». */
      const hideDraftScoresFromOthers = !isSelf && !canEditAll && !d.predCommitted;
      const scoreCellPlain = (side) => {
        const v = side === "home" ? d.pred.home : d.pred.away;
        return v === "" ? "—" : escapeHtml(String(v));
      };

      let ph;
      let pa;
      if (isSelf || canEditAll) {
        if (d.predCommitted || predictionsLocked) {
          ph = scoreCellPlain("home");
          pa = scoreCellPlain("away");
        } else if (!teamsDecided) {
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
      let tierExtra = "";
      if (officialCompleteForScoring && d.predCommitted && d.exact) {
        const ex = d.breakdown?.exactPts ?? 0;
        const exactBadge = ex > 0 ? pointsBadgeHtml(ex, { title: "Puntos por marcador exacto" }) : "";
        tierExtra = `<div class="quiniela-perfect-inline" role="status" aria-label="Marcador exacto"><span class="quiniela-perfect-label">Perfecto</span>${exactBadge}</div>`;
      } else if (officialCompleteForScoring && d.predCommitted) {
        const combo = quinielaComboBadgeNoPointsTier(d.breakdown, { apply: true });
        tierExtra = quinielaNoPointsTierExtraHtml(combo);
      }
      const phCell = quinielaCellWithBadges(ph, homeBadge);
      const paCell = quinielaCellWithBadges(pa, awayBadge);
      const pcCell = quinielaPtsCellContentHtml(pcRaw, d, officialCompleteForScoring);
      const selfNote = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      const editableClass = rowEditableByActor ? " quiniela-pred-edit-row" : "";

      let lastColTd;
      if (showPtsColumn) {
        const ptsTdCls = quinielaPtsTdClassList(d, {
          officialCompleteForScoring,
          maxPtsThisMatch,
        });
        lastColTd = `<td class="${ptsTdCls} quiniela-last-col">${pcCell}</td>`;
      } else {
        let preplayInner = "";
        if (isSelf || canEditAll) {
          const bothPred = d.pred.home !== "" && d.pred.away !== "";
          if (predictionsLocked) {
            const gameUnderway = matchStage !== "ready";
            if (!gameUnderway) preplayInner = '<span class="muted">Bloqueado</span>';
          } else if (d.predCommitted) {
            preplayInner = `<button type="button" class="btn btn-sm quiniela-pred-unlock-user" data-mid="${escapeHtml(m.id)}" data-pid="${escapeHtml(d.p.id)}">Cambiar</button>`;
          } else if (!teamsDecided) {
            preplayInner = '<span class="muted">Equipos por definir</span>';
          } else {
            preplayInner = `<button type="button" class="btn btn-primary btn-sm quiniela-pred-confirm-user" data-mid="${escapeHtml(m.id)}" data-pid="${escapeHtml(d.p.id)}" ${bothPred ? "" : "disabled"}>Confirmar</button>`;
          }
        }
        lastColTd = `<td class="quiniela-num quiniela-last-col quiniela-pred-actions">${preplayInner}</td>`;
      }

      const homeTdCls = ["quiniela-num", homeHit ? "quiniela-cell--hit" : ""].filter(Boolean).join(" ");
      const awayTdCls = ["quiniela-num", awayHit ? "quiniela-cell--hit" : ""].filter(Boolean).join(" ");
      const ganadorTdCls = ["quiniela-num", "quiniela-ganador-col", ganadorHit ? "quiniela-cell--hit" : ""]
        .filter(Boolean)
        .join(" ");

      const selfMidAttr = rowEditableByActor
        ? ` data-quiniela-self-mid="${escapeHtml(m.id)}" data-pred-pid="${escapeHtml(d.p.id)}"`
        : "";
      const participantTd = quinielaParticipantFirstTdHtml(d.p.name, selfNote, tierExtra, `${cls}${editableClass}`);
      return `<tr class="${cls}${editableClass}"${selfMidAttr}>${participantTd}<td class="${homeTdCls}">${phCell}</td><td class="${awayTdCls}">${paCell}</td><td class="${ganadorTdCls}">${ganadorCellInner}</td>${lastColTd}</tr>`;
    })
    .join("");
}

/**
 * HTML del contenido de la celda «Pts»: número en gradiente animado si esta fila tiene bono improbable (todas las filas con bono se marcan así).
 * @param {string} pcRaw «—» o el número en texto
 * @param {{ predCommitted: boolean, pts: unknown, breakdown?: { improbablePts?: number } | null }} d
 * @param {boolean} officialCompleteForScoring
 */
function quinielaPtsCellContentHtml(pcRaw, d, officialCompleteForScoring) {
  const plain = escapeHtml(pcRaw);
  const bonus =
    officialCompleteForScoring &&
    d.predCommitted &&
    (d.breakdown?.improbablePts ?? 0) > 0 &&
    d.pts !== null &&
    typeof d.pts === "number";
  if (!bonus) return `<span class="quiniela-cell-score-num">${plain}</span>`;
  return `<span class="quiniela-pts__bonus-num quiniela-cell-score-num">${plain}</span>`;
}

/**
 * Clases para la celda «Pts» de la quiniela (cero en rojo; bono improbable: número multicolor; máximo sin bono: texto dorado, sin fondo).
 * @param {{ predCommitted: boolean, pts: number|null, breakdown?: { improbablePts?: number } | null }} d
 * @param {{ officialCompleteForScoring: boolean, maxPtsThisMatch: number }} ctx
 */
function quinielaPtsTdClassList(d, ctx) {
  const { officialCompleteForScoring, maxPtsThisMatch } = ctx;
  const parts = ["quiniela-num", "quiniela-pts"];
  const hasScore =
    officialCompleteForScoring && d.predCommitted && d.pts !== null && typeof d.pts === "number";
  if (!hasScore) return parts.join(" ");
  const hasImprobableBonus = (d.breakdown?.improbablePts ?? 0) > 0;
  if (hasImprobableBonus) parts.push("quiniela-pts--bonus-rainbow");
  if (d.pts === 0) parts.push("quiniela-pts--zero");
  const isTop = maxPtsThisMatch > 0 && d.pts === maxPtsThisMatch;
  if (isTop && !hasImprobableBonus) parts.push("quiniela-pts--lead-text");
  return parts.join(" ");
}

/**
 * Fila(s) con máximo de puntos: borde superior/inferior según badge (BIEN / EXCELENTE / PERFECTO / PERFECTO+bono).
 * Multicolor animado solo con marcador «Perfecto» (no «Excelente») + bono improbable.
 * @param {{ predCommitted: boolean, pts: number|null, exact?: boolean, exactTier?: string|null, breakdown?: { improbablePts?: number, penaltyPts?: number } | null }} d
 * @param {{ officialCompleteForScoring: boolean, maxPtsThisMatch: number, comboApply: boolean }} ctx
 */
function quinielaPredRowLeadExtraClasses(d, ctx) {
  const { officialCompleteForScoring, maxPtsThisMatch, comboApply } = ctx;
  const hasScore =
    officialCompleteForScoring && d.predCommitted && d.pts !== null && typeof d.pts === "number";
  if (!hasScore || maxPtsThisMatch <= 0 || d.pts !== maxPtsThisMatch) return "";
  const imp = (d.breakdown?.improbablePts ?? 0) > 0;
  const exact = d.exact === true;
  let kind = "badge";
  if (exact && imp && d.exactTier !== "excelente") kind = "perfect-bonus";
  else if (exact && d.exactTier === "excelente") kind = "excelente";
  else if (exact) kind = "perfect";
  else if ((d.breakdown?.penaltyPts ?? 0) > 0) kind = "bien";
  else {
    const combo = quinielaComboBadgeNoPointsTier(d.breakdown, { apply: comboApply });
    if (combo === "excelente") kind = "excelente";
    else if (combo === "bien") kind = "bien";
    else kind = "badge";
  }
  return ` quiniela-pred-row--lead quiniela-pred-row--lead-${kind}`;
}

/**
 * @param {ReturnType<typeof getKnockoutMatchesFlat>[number]} m
 */
function buildQuinielaPredRowsHtmlKo(m, session, official, isAdmin) {
  void isAdmin;
  const canEditAll = canEditAllParticipantsPredictions(session.participantId);
  const matchScoring = getMatchScoringForQuiniela(m);
  const koPenaltyPhase = knockoutRoundRequiresPenaltyPickOnDraw(m.roundId);
  const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
  const officialConfirmed = official.knockoutScoresConfirmed?.[m.id] === true;
  const koStage = official.knockoutMatchState?.[m.id] ?? "ready";
  const bothFilled = off.home !== "" && off.away !== "";
  const officialCompleteForScoring = bothFilled && (koStage === "started" || officialConfirmed);
  const predictionsLocked = koStage !== "ready";
  const showPtsColumn = koStage !== "ready";

  const { ri, mi } = getKoRoundMatchIndex(m.id);
  const labelScoresKo = allFilledOfficialKnockoutScores(official);
  const koOfficialHome = resolveKnockoutSlotLabel(ri, mi, "home", labelScoresKo);
  const koOfficialAway = resolveKnockoutSlotLabel(ri, mi, "away", labelScoresKo);
  const koOfficialSlotsDecided =
    isQuinielaTeamSlotDecided(koOfficialHome) && isQuinielaTeamSlotDecided(koOfficialAway);
  const koSlotsReadyForEdit = koOfficialSlotsDecided || canEditAll;
  const preliminary = [...getParticipantsForDisplay()]
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
        ? computeGroupMatchPoints(off, r.pred, improbableSign, matchScoring, koPenaltyPhase)
        : null;
    const breakdown =
      officialCompleteForScoring && r.predCommitted
        ? computeGroupMatchPointsBreakdown(off, r.pred, improbableSign, matchScoring, koPenaltyPhase)
        : null;
    const exactTier = breakdown?.exactTier ?? null;
    const exact =
      breakdown && r.predCommitted ? isExactGroupPrediction(off, r.pred) : false;
    return { ...r, pts, breakdown, exact, exactTier };
  });

  const scoredPtsKo = rows.filter(
    (d) => officialCompleteForScoring && d.predCommitted && d.pts !== null,
  );
  const maxPtsThisMatchKo = scoredPtsKo.length ? Math.max(...scoredPtsKo.map((d) => d.pts)) : 0;

  const koOfficialDraw =
    officialCompleteForScoring && predictionOutcomeSign(off) === "d";

  return rows
    .map((d) => {
      let cls = "quiniela-pred-row partidos-ko-pred-row";
      if (d.p.id === session.participantId) cls += " quiniela-pred-row--self";
      if (showPtsColumn) {
        cls += quinielaPredRowLeadExtraClasses(d, {
          officialCompleteForScoring,
          maxPtsThisMatch: maxPtsThisMatchKo,
          comboApply: !koOfficialDraw,
        });
      }

      const vm = d.virtualM;
      const isSelf = d.p.id === session.participantId;
      const rowEditableByActor =
        (isSelf || canEditAll) && !predictionsLocked && !d.predCommitted && koSlotsReadyForEdit;
      const hideDraftScoresFromOthers = !isSelf && !canEditAll && !d.predCommitted;
      const scoreCellPlain = (side) => {
        const v = side === "home" ? d.pred.home : d.pred.away;
        return v === "" ? "—" : escapeHtml(String(v));
      };

      let ph;
      let pa;
      if (isSelf || canEditAll) {
        if (d.predCommitted || predictionsLocked) {
          ph = scoreCellPlain("home");
          pa = scoreCellPlain("away");
        } else if (!koSlotsReadyForEdit) {
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
      const penHit = false;
      const ganadorHit = Boolean(
        officialCompleteForScoring && d.breakdown && (d.breakdown.outcomePts > 0 || penHit),
      );

      let ganadorMainBadge = "";
      if (d.breakdown && officialCompleteForScoring && d.predCommitted) {
        const o = d.breakdown.outcomePts;
        const imp = d.breakdown.improbablePts;
        if (imp > 0 && o > 0) {
          ganadorMainBadge = pointsBadgeHtml(o + imp, {
            bonus: true,
            title: "Resultado acertado y bono resultado improbable (minoría acertada; el valor del botón es la suma de ambos)",
          });
        } else if (o > 0) {
          ganadorMainBadge = pointsBadgeHtml(o, {
            title: "Resultado acertado (ganador o empate)",
          });
        } else if (imp > 0) {
          ganadorMainBadge = pointsBadgeHtml(imp, {
            bonus: true,
            title: "Bono resultado improbable (minoría acertada)",
          });
        }
      }
      const ganadorBadges = `${ganadorMainBadge}`;
      const ganadorBadgesStack =
        ganadorBadges !== ""
          ? `<div class="quiniela-ganador-badges-stack">${ganadorMainBadge ? `<div class="quiniela-ganador-badges-stack__main">${ganadorMainBadge}</div>` : ""}</div>`
          : "";
      const showPenControls =
        rowEditableByActor && koPenaltyPhase && predictionOutcomeSign(d.pred) === "d";
      const ganadorInner = hideDraftScoresFromOthers
        ? '<span class="muted">—</span>'
        : quinielaKoGanadorCellHtml(vm, d.pred, m.roundId, {
            selfEditing: showPenControls,
            matchId: showPenControls ? m.id : "",
            targetParticipantId: showPenControls ? d.p.id : "",
          });
      const ganadorCellInner =
        ganadorBadges !== ""
          ? `<div class="quiniela-cell-badges-wrap quiniela-cell-badges-wrap--ganador"><div class="quiniela-cell-badges-main"><span class="quiniela-ganador-pick">${ganadorInner}</span></div>${ganadorBadgesStack}</div>`
          : `<div class="quiniela-cell-badges-wrap quiniela-cell-badges-wrap--ganador"><div class="quiniela-cell-badges-main"><span class="quiniela-ganador-pick">${ganadorInner}</span></div></div>`;

      const pcRaw = !officialCompleteForScoring ? "—" : d.pts === null ? "—" : String(d.pts);
      let tierExtra = "";
      if (officialCompleteForScoring && d.predCommitted && d.exact) {
        const ex = d.breakdown?.exactPts ?? 0;
        const exactBadge = ex > 0 ? pointsBadgeHtml(ex, { title: "Puntos por marcador exacto" }) : "";
        const exactWord = d.exactTier === "excelente" ? "Excelente" : "Perfecto";
        const exactLabelCls =
          d.exactTier === "excelente"
            ? "quiniela-perfect-label quiniela-perfect-label--excelente"
            : "quiniela-perfect-label";
        tierExtra = `<div class="quiniela-perfect-inline" role="status" aria-label="Marcador exacto"><span class="${exactLabelCls}">${exactWord}</span>${exactBadge}</div>`;
      } else if (officialCompleteForScoring && d.predCommitted && (d.breakdown?.penaltyPts ?? 0) > 0) {
        tierExtra = `<div class="quiniela-perfect-inline" role="status" aria-label="Empate y ganador en penales"><span class="group-preds-bien-label">Bien</span>${pointsBadgeHtml(d.breakdown.penaltyPts, {
          title: "Empate + ganador en penales (sin marcador exacto)",
        })}</div>`;
      } else if (officialCompleteForScoring && d.predCommitted) {
        const combo = quinielaComboBadgeNoPointsTier(d.breakdown, { apply: !koOfficialDraw });
        tierExtra = quinielaNoPointsTierExtraHtml(combo);
      }
      const phCell = quinielaCellWithBadges(ph, homeBadge);
      const paCell = quinielaCellWithBadges(pa, awayBadge);
      const pcCell = quinielaPtsCellContentHtml(pcRaw, d, officialCompleteForScoring);
      const selfNote = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      const editableClass = rowEditableByActor ? " partidos-ko-pred-edit-row" : "";

      let lastColTd;
      if (showPtsColumn) {
        const ptsTdCls = quinielaPtsTdClassList(d, {
          officialCompleteForScoring,
          maxPtsThisMatch: maxPtsThisMatchKo,
        });
        lastColTd = `<td class="${ptsTdCls} quiniela-last-col">${pcCell}</td>`;
      } else {
        let preplayInner = "";
        if (isSelf || canEditAll) {
          const scoresOk = d.pred.home !== "" && d.pred.away !== "";
          const drawPred = predictionOutcomeSign(d.pred) === "d";
          const penOk =
            !koPenaltyPhase || !drawPred || d.pred.penaltyWinner === "home" || d.pred.penaltyWinner === "away";
          const bothPred = scoresOk && penOk;
          if (predictionsLocked) {
            preplayInner = "";
          } else if (d.predCommitted) {
            preplayInner = `<button type="button" class="btn btn-sm partidos-ko-pred-unlock-user" data-kid="${escapeHtml(m.id)}" data-pid="${escapeHtml(d.p.id)}">Cambiar</button>`;
          } else if (!koSlotsReadyForEdit) {
            preplayInner = '<span class="muted">Equipos por definir</span>';
          } else {
            preplayInner = `<button type="button" class="btn btn-primary btn-sm partidos-ko-pred-confirm-user" data-kid="${escapeHtml(m.id)}" data-pid="${escapeHtml(d.p.id)}" ${bothPred ? "" : "disabled"}>Confirmar</button>`;
          }
        }
        lastColTd = `<td class="quiniela-num quiniela-last-col quiniela-pred-actions">${preplayInner}</td>`;
      }

      const homeTdCls = ["quiniela-num", homeHit ? "quiniela-cell--hit" : ""].filter(Boolean).join(" ");
      const awayTdCls = ["quiniela-num", awayHit ? "quiniela-cell--hit" : ""].filter(Boolean).join(" ");
      const ganadorTdCls = ["quiniela-num", "quiniela-ganador-col", ganadorHit ? "quiniela-cell--hit" : ""]
        .filter(Boolean)
        .join(" ");

      const selfKidAttr = rowEditableByActor
        ? ` data-partidos-ko-self-kid="${escapeHtml(m.id)}" data-pred-pid="${escapeHtml(d.p.id)}"`
        : "";
      const participantTd = quinielaParticipantFirstTdHtml(d.p.name, selfNote, tierExtra, `${cls}${editableClass}`);
      return `<tr class="${cls}${editableClass}"${selfKidAttr}>${participantTd}<td class="${homeTdCls}">${phCell}</td><td class="${awayTdCls}">${paCell}</td><td class="${ganadorTdCls}">${ganadorCellInner}</td>${lastColTd}</tr>`;
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
function renderQuinielaMatchCardKo(m, session, official, isAdmin, nextJornadaIds) {
  const canForceUndecidedMatches = canEditAllParticipantsPredictions(session.participantId);
  const { ri, mi } = getKoRoundMatchIndex(m.id);
  const labelScores = allFilledOfficialKnockoutScores(official);
  const homeLab = resolveKnockoutSlotLabel(ri, mi, "home", labelScores);
  const awayLab = resolveKnockoutSlotLabel(ri, mi, "away", labelScores);
  const officialSlotsDecided = isQuinielaTeamSlotDecided(homeLab) && isQuinielaTeamSlotDecided(awayLab);
  const officialSlotsReadyForAdmin = officialSlotsDecided || canForceUndecidedMatches;
  const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
  const koStage = official.knockoutMatchState?.[m.id] ?? "ready";
  const offOk = official.knockoutScoresConfirmed?.[m.id] === true;
  const vh = off.home === "" ? "—" : escapeHtml(String(off.home));
  const va = off.away === "" ? "—" : escapeHtml(String(off.away));
  const koOutcomeStyled = offOk && off.home !== "" && off.away !== "";
  const koOffHomeCls = koOutcomeStyled ? officialScoreOutcomeClass(off.home, off.away, "home") : "";
  const koOffAwayCls = koOutcomeStyled ? officialScoreOutcomeClass(off.home, off.away, "away") : "";
  const body = buildQuinielaPredRowsHtmlKo(m, session, official, isAdmin);
  const pStoreKo = loadPredictions(session.participantId);
  const userPredConfirmedKo = isUserPredictionConfirmedStore(pStoreKo, m);
  const matchClosedKo = isMatchOfficiallyClosed(official, m);
  const koInPlay = koStage === "started";
  const cornerHtmlKo = partidosMatchCornerHtml(m, nextJornadaIds, userPredConfirmedKo, matchClosedKo, koInPlay);
  const noKickHtmlKo = partidosAccNoKickoffHintHtml(m);
  const officialPreviewKo = partidosOfficialPreviewLineKo(m, official, officialSlotsDecided);
  const predInlineKo = !m.kickoff
    ? `<div class="partidos-acc__pred-row">${partidosUserPredPillHtml(userPredConfirmedKo, "inline", matchClosedKo)}</div>`
    : "";
  const kickClsKo = m.kickoff ? " partidos-match-card--has-kickoff" : "";

  const myPred = loadPredictions(session.participantId).knockoutScores ?? {};
  const colHomeFull = escapeHtml(resolveKnockoutSlotLabel(ri, mi, "home", myPred));
  const colAwayFull = escapeHtml(resolveKnockoutSlotLabel(ri, mi, "away", myPred));
  const colHome =
    colHomeFull.length > 20 ? `${colHomeFull.slice(0, 18)}…` : colHomeFull;
  const colAway =
    colAwayFull.length > 20 ? `${colAwayFull.slice(0, 18)}…` : colAwayFull;

  const statusBanner = koStage === "finished" && offOk
    ? `<p class="quiniela-match-status quiniela-match-status--done" role="status"><strong>Resultado oficial confirmado.</strong></p>`
    : !officialSlotsReadyForAdmin
      ? `<p class="quiniela-match-status quiniela-match-status--pending" role="status"><strong>Equipos por definir.</strong> Las predicciones y el marcador oficial quedan bloqueados hasta que los dos equipos estén fijados según los cruces anteriores.</p>`
    : !officialSlotsDecided && canForceUndecidedMatches
      ? `<p class="quiniela-match-status quiniela-match-status--pending" role="status"><strong>Modo pruebas ADMIN.</strong> Puedes cargar y confirmar marcador oficial aunque los equipos todavía estén por definir.</p>`
    : koStage === "started"
      ? `<p class="quiniela-match-status quiniela-match-status--live" role="status"><strong>En juego.</strong> Las predicciones están cerradas; el marcador oficial lo actualiza el admin.</p>`
      : `<p class="quiniela-match-status quiniela-match-status--ready" role="status"><strong>No ha comenzado.</strong> Aquí puedes editar y confirmar tu predicción.</p>`;

  const koPenNeeded =
    knockoutRoundRequiresPenaltyPickOnDraw(m.roundId) && isKnockoutScoreDrawNumbers(off.home, off.away);
  const koPenReady = off.penaltyWinner === "home" || off.penaltyWinner === "away";
  const canConfirmOfficialKo =
    koStage === "started" &&
    off.home !== "" &&
    off.away !== "" &&
    officialSlotsReadyForAdmin &&
    (!koPenNeeded || koPenReady);

  const officialMini = isAdmin
    ? `
      <div class="quiniela-official partidos-ko-official ${koStage === "started" ? "partidos-ko-official--editing" : "partidos-ko-official--locked"}" data-ko-mid="${escapeHtml(m.id)}">
        <div class="quiniela-official-head">
          Resultado oficial
          ${koStage === "finished" && offOk ? '<span class="quiniela-badge-confirmed">Confirmado</span>' : '<span class="muted">Borrador</span>'}
        </div>
        <div class="quiniela-official-grid ${koStage === "started" ? "quiniela-official-grid--edit" : "quiniela-official-grid--readonly"}">
          <div class="quiniela-cell quiniela-cell--team">${bracketTeamLineHtml(homeLab)}</div>
          <div class="quiniela-cell quiniela-cell--score${offOk ? koOffHomeCls : ""}">${koStage === "started" ? scoreStepperHtml(m.id, "home", off.home, { disabled: !officialSlotsReadyForAdmin, idAttr: "data-okid", extraClass: "quiniela-official-stepper" }) : vh}</div>
          <div class="quiniela-cell quiniela-cell--score${offOk ? koOffAwayCls : ""}">${koStage === "started" ? scoreStepperHtml(m.id, "away", off.away, { disabled: !officialSlotsReadyForAdmin, idAttr: "data-okid", extraClass: "quiniela-official-stepper" }) : va}</div>
          <div class="quiniela-cell quiniela-cell--team">${bracketTeamLineHtml(awayLab)}</div>
        </div>
        ${
          koStage === "started" && officialSlotsReadyForAdmin && koPenNeeded
            ? `<div class="partidos-ko-official-penalty" role="group" aria-label="Ganador en penales">
          <p class="muted partidos-ko-official-penalty__hint">Marcador empatado: indica el ganador en penales.</p>
          <div class="partidos-ko-official-penalty-btns">
            <button type="button" class="btn btn-sm ko-official-pen-pick${off.penaltyWinner === "home" ? " btn-primary" : ""}" data-okid-pen="${escapeHtml(m.id)}" data-pen-side="home">${bracketTeamLineHtml(homeLab)}</button>
            <button type="button" class="btn btn-sm ko-official-pen-pick${off.penaltyWinner === "away" ? " btn-primary" : ""}" data-okid-pen="${escapeHtml(m.id)}" data-pen-side="away">${bracketTeamLineHtml(awayLab)}</button>
          </div>
        </div>`
            : ""
        }
        <div class="quiniela-official-actions">
          ${
            koStage === "finished" && offOk
              ? `<button type="button" class="btn btn-sm partidos-ko-btn-unconfirm" data-kid="${escapeHtml(m.id)}">Desconfirmar</button><button type="button" class="btn btn-sm partidos-ko-btn-restart" data-kid="${escapeHtml(m.id)}">Reiniciar partido</button>`
              : koStage === "started"
                ? `<button type="button" class="btn btn-primary btn-sm partidos-ko-btn-confirm" data-kid="${escapeHtml(m.id)}" ${canConfirmOfficialKo ? "" : "disabled"}>Confirmar resultado</button>`
                : `<button type="button" class="btn btn-primary btn-sm partidos-ko-btn-start" data-kid="${escapeHtml(m.id)}" ${officialSlotsReadyForAdmin ? "" : "disabled"}>Iniciar partido</button>`
          }
        </div>
        ${
          koStage === "ready" && !officialSlotsReadyForAdmin
            ? `<p class="quiniela-official-hint muted">Completa los cruces previos en el resultado oficial para conocer ambos equipos antes de cargar el marcador.</p>`
            : koStage === "ready" && !officialSlotsDecided && canForceUndecidedMatches
              ? `<p class="quiniela-official-hint muted">Modo pruebas ADMIN activo: este partido permite cargar resultado oficial aunque los equipos sigan sin definir.</p>`
            : ""
        }
      </div>`
    : `
      <div class="quiniela-official">
        <div class="quiniela-official-head">Resultado oficial</div>
        <div class="quiniela-official-grid quiniela-official-grid--readonly">
          <div class="quiniela-cell quiniela-cell--team">${bracketTeamLineHtml(homeLab)}</div>
          <div class="quiniela-cell quiniela-cell--score${koOffHomeCls}">${vh}</div>
          <div class="quiniela-cell quiniela-cell--score${koOffAwayCls}">${va}</div>
          <div class="quiniela-cell quiniela-cell--team">${bracketTeamLineHtml(awayLab)}</div>
        </div>
        ${
          offOk && koPenNeeded && koPenReady
            ? `<p class="muted quiniela-official-penalty-readonly">Penales: <strong>${escapeHtml(off.penaltyWinner === "home" ? homeLab : awayLab)}</strong></p>`
            : ""
        }
      </div>`;

  const sigKo = nextJornadaIds.has(m.id) && !koInPlay ? " partidos-card--siguiente" : "";
  const enJuegoKoCls = koInPlay ? " partidos-card--en-juego" : "";
  const oficialPendienteClsKo = !matchClosedKo ? " partidos-card--oficial-pendiente" : "";
  const oficialCerradoClsKo = matchClosedKo ? " partidos-card--oficial-cerrado" : "";
  const quinielaPredsLastThKo =
    koStage !== "ready"
      ? `<th class="quiniela-num quiniela-last-col" scope="col">Pts</th>`
      : `<th class="quiniela-num quiniela-last-col quiniela-last-col--preplay" scope="col"><span class="visually-hidden">Confirmar o cambiar predicción</span></th>`;
  const quinielaPredsTableClsKo =
    koStage === "ready" ? "table table-compact quiniela-preds quiniela-preds--preplay" : "table table-compact quiniela-preds";
  return `
    <article class="card quiniela-match partidos-match-card partidos-ko-card${kickClsKo}${sigKo}${enJuegoKoCls}${oficialPendienteClsKo}${oficialCerradoClsKo}" data-ko-round="${escapeHtml(m.roundId)}" data-quiniela-mid="${escapeHtml(m.id)}">
      ${cornerHtmlKo}
      <details class="partidos-acc">
        <summary class="partidos-acc__summary">
          <span class="partidos-acc__chev" aria-hidden="true"></span>
          <div class="partidos-acc__summary-main">
            <h2 class="partidos-acc__title quiniela-match-title">${escapeHtml(knockoutPhaseTitle(m.roundId))} · ${bracketTeamLineHtml(homeLab)} <span class="vs">vs</span> ${bracketTeamLineHtml(awayLab)}</h2>
            ${noKickHtmlKo}
            ${predInlineKo}
            <div class="partidos-acc__official-preview">${officialPreviewKo}</div>
          </div>
        </summary>
        <div class="partidos-acc__body">
          ${statusBanner}
          ${officialMini}
          <div class="quiniela-preds-head">Predicciones</div>
          <div class="table-scroll quiniela-table-wrap">
            <table class="${quinielaPredsTableClsKo}">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th class="quiniela-num" title="${colHomeFull}">${colHome}</th>
                  <th class="quiniela-num" title="${colAwayFull}">${colAway}</th>
                  <th class="quiniela-num quiniela-ganador-col" scope="col">Ganador</th>
                  ${quinielaPredsLastThKo}
                </tr>
              </thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        </div>
      </details>
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
  const anchor = capturePartidosInteractionAnchor(wrap);
  const viewportLock =
    anchor?.articleMid === mid
      ? (() => {
          const ae = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(mid)}"]`);
          return ae ? { mid, vTop: ae.getBoundingClientRect().top } : null;
        })()
      : null;
  const isAdmin = canEditOfficialResults(session.participantId);
  tb.innerHTML = buildQuinielaPredRowsHtml(m, session, loadOfficialResults(), isAdmin);
  wireQuinielaPredictionHandlersInScope(card, session);
  syncQuinielaPerfectBonusCanvases(wrap);
  syncGroupPtsBadgeCanvases(wrap);
  if (anchor?.articleMid === mid) restorePartidosInteractionAnchor(wrap, anchor, viewportLock);
}

/**
 * Igual que patchQuinielaMatchPredRows pero para cruces KO (`GROUP_MATCHES` no los incluye).
 * @param {HTMLElement | null} wrap
 * @param {string} kid
 */
function patchQuinielaKoMatchPredRows(wrap, kid) {
  const session = loadSession();
  if (!wrap || !session) return;
  const m = getKnockoutMatchesFlat().find((x) => x.id === kid);
  if (!m) return;
  const card = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(kid)}"]`);
  if (!card) return;
  const tb = card.querySelector(".quiniela-preds tbody");
  if (!tb) return;
  const anchor = capturePartidosInteractionAnchor(wrap);
  const viewportLock =
    anchor?.articleMid === kid
      ? (() => {
          const ae = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(kid)}"]`);
          return ae ? { mid: kid, vTop: ae.getBoundingClientRect().top } : null;
        })()
      : null;
  const isAdmin = canEditOfficialResults(session.participantId);
  tb.innerHTML = buildQuinielaPredRowsHtmlKo(m, session, loadOfficialResults(), isAdmin);
  wireQuinielaPredictionHandlersInScope(card, session);
  syncQuinielaPerfectBonusCanvases(wrap);
  syncGroupPtsBadgeCanvases(wrap);
  if (anchor?.articleMid === kid) restorePartidosInteractionAnchor(wrap, anchor, viewportLock);
}

/**
 * Solo tbody + resto de la app: no reemplaza #quiniela-wrap (evita scroll al 1.er partido con varios abiertos).
 * @param {{ participantId: string }} session
 * @param {string} matchId id de partido de grupos o KO
 */
function refreshAfterParticipantPredictionScores(session, matchId) {
  const wrap = $("#quiniela-wrap");
  if (wrap && GROUP_MATCHES.some((x) => x.id === matchId)) {
    patchQuinielaMatchPredRows(wrap, matchId);
  } else if (wrap) {
    patchQuinielaKoMatchPredRows(wrap, matchId);
  }
  refreshAll(session, { skipPartidosRender: true });
}

/**
 * Sustituye un solo `<article>` (p. ej. tras confirmar predicción: cambia pill del summary) y re-enlaza handlers.
 * @param {HTMLElement} wrap
 * @param {string} matchId
 * @param {{ participantId: string }} session
 */
function replaceQuinielaMatchArticleAndRebind(wrap, matchId, session) {
  const oldArt = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(matchId)}"]`);
  if (!(oldArt instanceof HTMLElement)) return;
  const official = loadOfficialResults();
  const isAdmin = canEditOfficialResults(session.participantId);
  const nextHighlightIds = getNextMatchDayHighlightIds(official, allMatchesForPartidosCalendar());
  const det = oldArt.querySelector("details.partidos-acc");
  const wasOpen = det instanceof HTMLDetailsElement && det.open;
  const m = GROUP_MATCHES.find((x) => x.id === matchId);
  const html = m
    ? renderQuinielaMatchCard(m, session, official, isAdmin, nextHighlightIds)
    : (() => {
        const mKo = getKnockoutMatchesFlat().find((x) => x.id === matchId);
        return mKo ? renderQuinielaMatchCardKo(mKo, session, official, isAdmin, nextHighlightIds) : "";
      })();
  if (!html) return;
  oldArt.outerHTML = html;
  const newArt = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(matchId)}"]`);
  if (!(newArt instanceof HTMLElement)) return;
  if (wasOpen) {
    const d = newArt.querySelector("details.partidos-acc");
    if (d instanceof HTMLDetailsElement) d.open = true;
  }
  wireQuinielaPredictionHandlersInScope(newArt, session);
  syncQuinielaPerfectBonusCanvases(wrap);
  syncGroupPtsBadgeCanvases(wrap);
  if (isAdmin) bindPartidosAdminHandlers(newArt, session);
}

/**
 * @param {HTMLElement} scope
 * @param {{ participantId: string }} session
 */
function bindPartidosAdminHandlers(scope, session) {
  const partidosWrap = $("#quiniela-wrap");
  if (!scope || !partidosWrap) return;
  const canForceUndecidedMatches = canEditAllParticipantsPredictions(session.participantId);
  scope.querySelectorAll(".quiniela-btn-iniciar-partido").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mid = btn.dataset.mid;
      if (!mid) return;
      const gm = GROUP_MATCHES.find((x) => x.id === mid);
      if (
        !gm ||
        ((!isQuinielaTeamSlotDecided(gm.home) || !isQuinielaTeamSlotDecided(gm.away)) && !canForceUndecidedMatches)
      ) {
        return;
      }
      saveOfficialResults({
        groupMatchState: { [mid]: "started" },
        groupScores: { [mid]: { home: 0, away: 0 } },
      });
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".quiniela-official--editing").forEach((ed) => {
    wireScoreSteppers(
      ed,
      "grupos",
      (partial) => {
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
        patchQuinielaMatchPredRows(partidosWrap, mid);
        const sess = loadSession();
        renderFloatingRanking(sess);
        redrawMatchRanking();
        redrawMatchHistory();
        renderStats(sess);
        renderFinalRanking(sess);
      },
      { collectOnInput: true },
    );
  });

  scope.querySelectorAll(".quiniela-btn-terminar-partido").forEach((btn) => {
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

  scope.querySelectorAll(".quiniela-btn-desconfirmar-partido").forEach((btn) => {
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

  scope.querySelectorAll(".quiniela-btn-reiniciar-partido").forEach((btn) => {
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

  scope.querySelectorAll(".partidos-ko-official--editing").forEach((ed) => {
    wireOfficialKnockoutSteppers(ed, (partial) => {
      const kid = ed.dataset.koMid;
      if (!kid || !partial[kid]) return;
      const latest = loadOfficialResults();
      const prev = latest.knockoutScores?.[kid] ?? {};
      const merged = { ...prev, ...partial[kid] };
      const mKo = getKnockoutMatchesFlat().find((x) => x.id === kid);
      const penPh = mKo ? knockoutRoundRequiresPenaltyPickOnDraw(mKo.roundId) : false;
      if (!penPh) {
        merged.penaltyWinner = "";
      } else if (!isKnockoutScoreDrawNumbers(merged.home, merged.away)) {
        merged.penaltyWinner = "";
      } else {
        merged.penaltyWinner = prev.penaltyWinner === "home" || prev.penaltyWinner === "away" ? prev.penaltyWinner : "";
      }
      const next = { ...latest.knockoutScores, [kid]: merged };
      const changed =
        String(prev.home ?? "") !== String(merged.home ?? "") ||
        String(prev.away ?? "") !== String(merged.away ?? "") ||
        String(prev.penaltyWinner ?? "") !== String(merged.penaltyWinner ?? "");
      saveOfficialResults({
        knockoutScores: next,
        ...(changed && latest.knockoutScoresConfirmed?.[kid] === true
          ? { knockoutScoresConfirmed: { [kid]: false } }
          : {}),
      });
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".ko-official-pen-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.okidPen;
      const side = btn.dataset.penSide;
      if (!id || (side !== "home" && side !== "away")) return;
      const latest = loadOfficialResults();
      const prev = latest.knockoutScores?.[id] ?? { home: "", away: "" };
      saveOfficialResults({
        knockoutScores: {
          ...latest.knockoutScores,
          [id]: { ...prev, penaltyWinner: side },
        },
        ...(latest.knockoutScoresConfirmed?.[id] === true ? { knockoutScoresConfirmed: { [id]: false } } : {}),
      });
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".partidos-ko-btn-confirm").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kid;
      if (!kid) return;
      const o = loadOfficialResults();
      if ((o.knockoutMatchState?.[kid] ?? "ready") !== "started") return;
      const { ri, mi } = getKoRoundMatchIndex(kid);
      const labelO = allFilledOfficialKnockoutScores(o);
      const oh = resolveKnockoutSlotLabel(ri, mi, "home", labelO);
      const oa = resolveKnockoutSlotLabel(ri, mi, "away", labelO);
      const canForceUndecidedMatches2 = canEditAllParticipantsPredictions(session.participantId);
      if (
        (!isQuinielaTeamSlotDecided(oh) || !isQuinielaTeamSlotDecided(oa)) &&
        !canForceUndecidedMatches2
      ) {
        return;
      }
      const sc = o.knockoutScores?.[kid];
      if (!sc || sc.home === "" || sc.away === "") return;
      const mKo = getKnockoutMatchesFlat().find((x) => x.id === kid);
      const needPen =
        mKo &&
        knockoutRoundRequiresPenaltyPickOnDraw(mKo.roundId) &&
        isKnockoutScoreDrawNumbers(sc.home, sc.away);
      if (needPen && sc.penaltyWinner !== "home" && sc.penaltyWinner !== "away") return;
      saveOfficialResults({
        knockoutScoresConfirmed: { [kid]: true },
        knockoutMatchState: { [kid]: "finished" },
      });
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".partidos-ko-btn-start").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kid;
      if (!kid) return;
      const o = loadOfficialResults();
      if ((o.knockoutMatchState?.[kid] ?? "ready") !== "ready") return;
      const { ri, mi } = getKoRoundMatchIndex(kid);
      const labelO = allFilledOfficialKnockoutScores(o);
      const oh = resolveKnockoutSlotLabel(ri, mi, "home", labelO);
      const oa = resolveKnockoutSlotLabel(ri, mi, "away", labelO);
      const canForceUndecidedMatches3 = canEditAllParticipantsPredictions(session.participantId);
      if (
        (!isQuinielaTeamSlotDecided(oh) || !isQuinielaTeamSlotDecided(oa)) &&
        !canForceUndecidedMatches3
      ) {
        return;
      }
      saveOfficialResults({
        knockoutMatchState: { [kid]: "started" },
        knockoutScores: { [kid]: { home: 0, away: 0, penaltyWinner: "" } },
      });
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".partidos-ko-btn-unconfirm").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kid;
      if (!kid) return;
      saveOfficialResults({
        knockoutScoresConfirmed: { [kid]: false },
        knockoutMatchState: { [kid]: "started" },
      });
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".partidos-ko-btn-restart").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kid;
      if (!kid) return;
      saveOfficialResults({
        knockoutScoresConfirmed: { [kid]: false },
        knockoutMatchState: { [kid]: "ready" },
      });
      refreshAll(loadSession());
    });
  });
}

/**
 * @param {HTMLElement} scope
 * @param {{ participantId: string }} session
 */
function wireQuinielaPredictionHandlersInScope(scope, session) {
  scope.querySelectorAll(".quiniela-pred-edit-row").forEach((row) => {
    wireScoreSteppers(row, "grupos", (partial) => {
      const mid = row.dataset.quinielaSelfMid;
      const targetParticipantId = row.dataset.predPid || session.participantId;
      if (!mid || !partial[mid] || !targetParticipantId) return;
      savePredictions(targetParticipantId, {
        groupScores: { [mid]: { home: partial[mid].home, away: partial[mid].away } },
      });
      refreshAfterParticipantPredictionScores(loadSession(), mid);
    });
  });

  scope.querySelectorAll(".quiniela-pred-confirm-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mid = btn.dataset.mid;
      const targetParticipantId = btn.dataset.pid || session.participantId;
      if (!mid || !targetParticipantId) return;
      const gm = GROUP_MATCHES.find((x) => x.id === mid);
      if (
        !gm ||
        !isQuinielaTeamSlotDecided(gm.home) ||
        !isQuinielaTeamSlotDecided(gm.away)
      ) {
        return;
      }
      const offNow = loadOfficialResults();
      if ((offNow.groupMatchState?.[mid] ?? "ready") !== "ready") return;
      const latest = loadPredictions(targetParticipantId);
      const sc = latest.groupScores[mid] ?? { home: "", away: "" };
      if (sc.home === "" || sc.away === "") return;
      savePredictions(targetParticipantId, { groupScoresConfirmed: { [mid]: true } });
      const sess = loadSession();
      const wrap = $("#quiniela-wrap");
      if (wrap) replaceQuinielaMatchArticleAndRebind(wrap, mid, sess);
      refreshAll(sess, { skipPartidosRender: true });
    });
  });

  scope.querySelectorAll(".quiniela-pred-unlock-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mid = btn.dataset.mid;
      const targetParticipantId = btn.dataset.pid || session.participantId;
      if (!mid || !targetParticipantId) return;
      const offNow = loadOfficialResults();
      if ((offNow.groupMatchState?.[mid] ?? "ready") !== "ready") return;
      const latest = loadPredictions(targetParticipantId);
      const { [mid]: _r, ...rest } = latest.groupScoresConfirmed ?? {};
      savePredictions(targetParticipantId, {
        groupScoresConfirmed: rest,
        replaceGroupScoresConfirmed: true,
      });
      const sess = loadSession();
      const wrap = $("#quiniela-wrap");
      if (wrap) replaceQuinielaMatchArticleAndRebind(wrap, mid, sess);
      refreshAll(sess, { skipPartidosRender: true });
    });
  });

  scope.querySelectorAll(".partidos-ko-pred-edit-row").forEach((row) => {
    wireScoreSteppers(row, "knockout", (partial) => {
      const kid = row.dataset.partidosKoSelfKid;
      const targetParticipantId = row.dataset.predPid || session.participantId;
      if (!kid || !partial[kid] || !targetParticipantId) return;
      const latest = loadPredictions(targetParticipantId);
      const prevSc = latest.knockoutScores?.[kid] ?? {};
      const mKo = getKnockoutMatchesFlat().find((x) => x.id === kid);
      const penPh = mKo ? knockoutRoundRequiresPenaltyPickOnDraw(mKo.roundId) : false;
      const home = partial[kid].home;
      const away = partial[kid].away;
      const merged = { ...prevSc, home, away };
      if (!penPh) {
        merged.penaltyWinner = "";
      } else if (!isKnockoutScoreDrawNumbers(home, away)) {
        merged.penaltyWinner = "";
      } else {
        merged.penaltyWinner = prevSc.penaltyWinner === "home" || prevSc.penaltyWinner === "away" ? prevSc.penaltyWinner : "";
      }
      savePredictions(targetParticipantId, {
        knockoutScores: {
          ...latest.knockoutScores,
          [kid]: merged,
        },
      });
      refreshAfterParticipantPredictionScores(loadSession(), kid);
    });
  });

  scope.querySelectorAll(".ko-user-pen-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kidPen;
      const targetParticipantId = btn.dataset.pid || session.participantId;
      const pick = btn.dataset.penPick;
      if (!kid || !targetParticipantId || (pick !== "home" && pick !== "away")) return;
      const latest = loadPredictions(targetParticipantId);
      const prev = latest.knockoutScores?.[kid] ?? { home: "", away: "" };
      savePredictions(targetParticipantId, {
        knockoutScores: {
          ...latest.knockoutScores,
          [kid]: { ...prev, penaltyWinner: pick },
        },
      });
      refreshAfterParticipantPredictionScores(loadSession(), kid);
    });
  });

  scope.querySelectorAll(".partidos-ko-pred-confirm-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kid;
      const targetParticipantId = btn.dataset.pid || session.participantId;
      if (!kid || !targetParticipantId) return;
      const offPred = loadOfficialResults();
      if (offPred.knockoutScoresConfirmed?.[kid] === true) return;
      if ((offPred.knockoutMatchState?.[kid] ?? "ready") !== "ready") return;
      const { ri, mi } = getKoRoundMatchIndex(kid);
      const labelPred = allFilledOfficialKnockoutScores(offPred);
      const kh = resolveKnockoutSlotLabel(ri, mi, "home", labelPred);
      const ka = resolveKnockoutSlotLabel(ri, mi, "away", labelPred);
      const canForceUndecidedMatches = canEditAllParticipantsPredictions(session.participantId);
      if (
        (!isQuinielaTeamSlotDecided(kh) || !isQuinielaTeamSlotDecided(ka)) &&
        !canForceUndecidedMatches
      ) {
        return;
      }
      const latest = loadPredictions(targetParticipantId);
      const sc = latest.knockoutScores?.[kid] ?? { home: "", away: "" };
      if (sc.home === "" || sc.away === "") return;
      const mR = getKnockoutMatchesFlat().find((x) => x.id === kid);
      const koPen = mR ? knockoutRoundRequiresPenaltyPickOnDraw(mR.roundId) : false;
      if (
        koPen &&
        predictionOutcomeSign(sc) === "d" &&
        sc.penaltyWinner !== "home" &&
        sc.penaltyWinner !== "away"
      ) {
        return;
      }
      savePredictions(targetParticipantId, { knockoutScoresConfirmed: { [kid]: true } });
      const sess = loadSession();
      const wrap = $("#quiniela-wrap");
      if (wrap) replaceQuinielaMatchArticleAndRebind(wrap, kid, sess);
      refreshAll(sess, { skipPartidosRender: true });
    });
  });

  scope.querySelectorAll(".partidos-ko-pred-unlock-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kid;
      const targetParticipantId = btn.dataset.pid || session.participantId;
      if (!kid || !targetParticipantId) return;
      if (loadOfficialResults().knockoutScoresConfirmed?.[kid] === true) return;
      if ((loadOfficialResults().knockoutMatchState?.[kid] ?? "ready") !== "ready") return;
      const latest = loadPredictions(targetParticipantId);
      const { [kid]: _r, ...rest } = latest.knockoutScoresConfirmed ?? {};
      savePredictions(targetParticipantId, {
        knockoutScoresConfirmed: rest,
        replaceKnockoutScoresConfirmed: true,
      });
      const sess = loadSession();
      const wrap = $("#quiniela-wrap");
      if (wrap) replaceQuinielaMatchArticleAndRebind(wrap, kid, sess);
      refreshAll(sess, { skipPartidosRender: true });
    });
  });
}

function redrawQuiniela() {
  const session = loadSession();
  renderQuiniela(session, loadOfficialResults());
  updateProximosNavShortcutButton(session);
  if (session) {
    updatePredictionTabsProgress(session, loadPredictions(session.participantId));
  } else {
    updatePredictionTabsProgress(null, null);
  }
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

  const rows = getParticipantsForDisplay().map((p) => {
    const pStore = loadPredictions(p.id);
    let bienCount = 0;
    let excelenteCount = 0;
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
      if (pts != null) totalPoints += pts;
      if (breakdown?.exactTier === "perfecto") perfectCount += 1;
      else if (breakdown?.exactTier === "excelente") excelenteCount += 1;
      else if (breakdown?.exactTier === "bien") bienCount += 1;
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
      const koPenPh = knockoutRoundRequiresPenaltyPickOnDraw(m.roundId);
      const pts = computeGroupMatchPoints(off, pred, improbableSign, scoring, koPenPh);
      const breakdown = computeGroupMatchPointsBreakdown(off, pred, improbableSign, scoring, koPenPh);
      if (pts != null) totalPoints += pts;
      if (breakdown?.exactTier === "perfecto") perfectCount += 1;
      else if (breakdown?.exactTier === "excelente") excelenteCount += 1;
      else if (breakdown?.exactTier === "bien") bienCount += 1;
      if (breakdown?.improbablePts && breakdown.improbablePts > 0) bonusCount += 1;
    }

    return { participant: p, bienCount, excelenteCount, perfectCount, bonusCount, totalPoints };
  });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.perfectCount !== a.perfectCount) return b.perfectCount - a.perfectCount;
    if (b.excelenteCount !== a.excelenteCount) return b.excelenteCount - a.excelenteCount;
    if (b.bienCount !== a.bienCount) return b.bienCount - a.bienCount;
    if (b.bonusCount !== a.bonusCount) return b.bonusCount - a.bonusCount;
    return a.participant.name.localeCompare(b.participant.name);
  });

  const maxBien = Math.max(0, ...rows.map((r) => r.bienCount));
  const maxExcelente = Math.max(0, ...rows.map((r) => r.excelenteCount));
  const maxPerfect = Math.max(0, ...rows.map((r) => r.perfectCount));
  const maxBonus = Math.max(0, ...rows.map((r) => r.bonusCount));
  const maxTotal = Math.max(0, ...rows.map((r) => r.totalPoints));

  return rows
    .map((r, idx) => {
      const isSelf = r.participant.id === sessionParticipantId;
      const podium = idx === 0 ? "group-ranking-row--gold" : idx === 1 ? "group-ranking-row--silver" : idx === 2 ? "group-ranking-row--bronze" : "";
      const rowCls = ["match-ranking-row", podium, isSelf ? "row-self" : ""].filter(Boolean).join(" ");
      const you = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      return `<tr class="${rowCls}">
        <td class="group-ranking-rank">${idx + 1}</td>
        <th scope="row" class="group-ranking-name">${escapeHtml(r.participant.name)}${you}</th>
        ${groupOrderRankingStatCell(
          r.bienCount,
          "BIEN en partidos (badge unico por partido).",
          maxBien > 0 && r.bienCount === maxBien,
          "bien",
        )}
        ${groupOrderRankingStatCell(
          r.excelenteCount,
          "EXCELENTE en partidos (badge unico por partido).",
          maxExcelente > 0 && r.excelenteCount === maxExcelente,
          "excelente",
        )}
        ${groupOrderRankingStatCell(
          r.perfectCount,
          "PERFECTO en partidos (badge unico por partido).",
          maxPerfect > 0 && r.perfectCount === maxPerfect,
          "perfecto",
        )}
        ${groupOrderRankingStatCell(
          r.bonusCount,
          "BONUS en partidos.",
          maxBonus > 0 && r.bonusCount === maxBonus,
          "bonus",
        )}
        <td class="group-ranking-num group-ranking-total ${maxTotal > 0 && r.totalPoints === maxTotal ? "group-ranking-total--top" : ""}"><strong>${r.totalPoints}</strong></td>
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
    return;
  }
  ensureMatchRankingFilters();
  const scopeSel = $("#match-ranking-scope-filter");
  const groupSel = $("#match-ranking-group-filter");
  const scope = scopeSel?.value ?? "all";
  const groupId = groupSel?.value ?? "";
  body.innerHTML = computeMatchRankingRows(scope, groupId, session.participantId);
}

function formatPredScoreCell(pred, roundId) {
  const h = pred?.home === "" || pred?.home == null ? "—" : escapeHtml(String(pred.home));
  const a = pred?.away === "" || pred?.away == null ? "—" : escapeHtml(String(pred.away));
  let out = `${h} - ${a}`;
  if (
    roundId &&
    knockoutRoundRequiresPenaltyPickOnDraw(roundId) &&
    predictionOutcomeSign(pred) === "d" &&
    (pred?.penaltyWinner === "home" || pred?.penaltyWinner === "away")
  ) {
    out +=
      pred.penaltyWinner === "home"
        ? ' <span class="muted">(pen. L)</span>'
        : ' <span class="muted">(pen. V)</span>';
  }
  return out;
}

function formatOfficialScoreCell(off, show, roundId) {
  if (!show) return '<span class="muted">—</span>';
  const h = off?.home === "" || off?.home == null ? "—" : escapeHtml(String(off.home));
  const a = off?.away === "" || off?.away == null ? "—" : escapeHtml(String(off.away));
  let out = `${h} - ${a}`;
  if (
    roundId &&
    knockoutRoundRequiresPenaltyPickOnDraw(roundId) &&
    isKnockoutScoreDrawNumbers(off.home, off.away) &&
    (off?.penaltyWinner === "home" || off?.penaltyWinner === "away")
  ) {
    out +=
      off.penaltyWinner === "home"
        ? ' <span class="muted">(pen. L)</span>'
        : ' <span class="muted">(pen. V)</span>';
  }
  return out;
}

/**
 * Estado del partido oficial: terminado, calendario (es hoy / en X días) o transitorios.
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {{ id: string, kickoff?: string | null, groupId?: string, roundId?: string }} m
 */
function matchHistoryEstadoPartidoHtml(official, m) {
  if (isMatchOfficiallyClosed(official, m)) {
    return '<span class="match-history-estado match-history-estado--done">Terminado</span>';
  }
  if (!m.kickoff) return '<span class="muted">Sin fecha</span>';

  const enJuegoHtml = () =>
    '<span class="match-history-estado match-history-estado--live">EN JUEGO</span>';

  /* Antes del contador: si ya está en vivo, no mostrar «En X días» aunque el kickoff sea futuro. */
  if (m.groupId != null) {
    const stage = official.groupMatchState?.[m.id] ?? "ready";
    if (stage === "started") {
      return enJuegoHtml();
    }
    if (stage === "finished" && official.groupScoresConfirmed?.[m.id] !== true) {
      return '<span class="match-history-estado match-history-estado--wait">Pendiente confirmación</span>';
    }
  }
  if (m.roundId != null) {
    const offKo = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
    const koOk = official.knockoutScoresConfirmed?.[m.id] === true;
    const koBoth = offKo.home !== "" && offKo.away !== "";
    if (koBoth && !koOk) {
      const { ri, mi } = getKoRoundMatchIndex(m.id);
      const lab = allFilledOfficialKnockoutScores(official);
      const kh = resolveKnockoutSlotLabel(ri, mi, "home", lab);
      const ka = resolveKnockoutSlotLabel(ri, mi, "away", lab);
      if (isQuinielaTeamSlotDecided(kh) && isQuinielaTeamSlotDecided(ka)) {
        return enJuegoHtml();
      }
    }
  }

  const d = daysUntilKickoffLocal(m.kickoff);
  if (d === null) return '<span class="muted">—</span>';
  if (d === 0) return '<span class="match-history-estado match-history-estado--today">Es hoy</span>';
  if (d > 0) {
    return `<span class="match-history-estado match-history-estado--future">En ${d} día${d === 1 ? "" : "s"}</span>`;
  }
  return '<span class="muted">Pendiente</span>';
}

function matchHistoryPrediccionEnviadaHtml(predConfirmed) {
  return predConfirmed
    ? '<span class="match-history-sent match-history-sent--ok">Enviada</span>'
    : '<span class="match-history-sent">Faltante</span>';
}

/** Máximo de puntos entre todos los participantes con predicción confirmada (misma lógica que la quiniela). */
function maxGroupMatchPtsAmongParticipants(m, official) {
  const off = official.groupScores?.[m.id] ?? { home: "", away: "" };
  const stage = official.groupMatchState?.[m.id] ?? "ready";
  const officialConfirmed = stage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
  const bothFilled = off.home !== "" && off.away !== "";
  const officialComplete = bothFilled && (stage === "started" || officialConfirmed);
  if (!officialComplete) return 0;
  const improbableSign = getImprobableOutcomeSignForMatch(m.id, off);
  const scoring = getMatchScoringForQuiniela(m);
  let max = 0;
  for (const p of getParticipantsForDisplay()) {
    const store = loadPredictions(p.id);
    if (store.groupScoresConfirmed?.[m.id] !== true) continue;
    const pred = store.groupScores[m.id] ?? { home: "", away: "" };
    const pts = computeGroupMatchPoints(off, pred, improbableSign, scoring);
    if (pts != null && pts > max) max = pts;
  }
  return max;
}

function maxKoMatchPtsAmongParticipants(m, official) {
  const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
  const officialConfirmed = official.knockoutScoresConfirmed?.[m.id] === true;
  const bothFilled = off.home !== "" && off.away !== "";
  const officialComplete = bothFilled && officialConfirmed;
  if (!officialComplete) return 0;
  const improbableSign = getImprobableOutcomeSignForKoMatch(m.id, off);
  const scoring = getMatchScoringForQuiniela(m);
  const koPenPh = knockoutRoundRequiresPenaltyPickOnDraw(m.roundId);
  let max = 0;
  for (const p of getParticipantsForDisplay()) {
    const store = loadPredictions(p.id);
    if (store.knockoutScoresConfirmed?.[m.id] !== true) continue;
    const pred = store.knockoutScores?.[m.id] ?? { home: "", away: "" };
    const pts = computeGroupMatchPoints(off, pred, improbableSign, scoring, koPenPh);
    if (pts != null && pts > max) max = pts;
  }
  return max;
}

/**
 * Celda «Puntos» del historial: número siempre visible (no badge flotante), mismas clases que la quiniela.
 * @param {number} pts
 * @param {ReturnType<typeof computeGroupMatchPointsBreakdown> | null} breakdown
 * @param {{ maxPerMatch: number }} scoring
 * @param {boolean} officialComplete
 * @param {boolean} predConfirmed
 * @param {number} maxPtsAmongAll
 */
function matchHistoryPointsTdHtml(pts, breakdown, scoring, officialComplete, predConfirmed, maxPtsAmongAll) {
  const dLike = { predCommitted: predConfirmed, pts, breakdown };
  const ctx = { officialCompleteForScoring: officialComplete, maxPtsThisMatch: maxPtsAmongAll };
  const cls = quinielaPtsTdClassList(dLike, ctx);
  let inner = quinielaPtsCellContentHtml(String(pts), dLike, officialComplete);
  if (pts > scoring.maxPerMatch) {
    inner = `<strong class="team-order-total-value team-order-total-value--rainbow">${inner}</strong>`;
  }
  return `<td class="match-history-pts ${cls}">${inner}</td>`;
}

function buildMatchHistory(participantId) {
  const official = loadOfficialResults();
  const pStore = loadPredictions(participantId);
  let total = 0;
  let totalPossible = 0;

  const groupMatchMaxPts = Object.fromEntries(
    GROUP_MATCHES.map((m) => [m.id, maxGroupMatchPtsAmongParticipants(m, official)]),
  );
  const koMatchMaxPts = Object.fromEntries(
    getKnockoutMatchesFlat().map((m) => [m.id, maxKoMatchPtsAmongParticipants(m, official)]),
  );

  /** @type {Array<{ m: (typeof GROUP_MATCHES)[number] | ReturnType<typeof getKnockoutMatchesFlat>[number], kind: "group" | "ko" }>} */
  const items = [
    ...GROUP_MATCHES.map((m) => ({ m, kind: /** @type {const} */ ("group") })),
    ...getKnockoutMatchesFlat().map((m) => ({ m, kind: /** @type {const} */ ("ko") })),
  ];
  items.sort((a, b) => {
    const ta = a.m.kickoff ? Date.parse(a.m.kickoff) : Number.POSITIVE_INFINITY;
    const tb = b.m.kickoff ? Date.parse(b.m.kickoff) : Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return String(a.m.id).localeCompare(String(b.m.id));
  });

  const rows = [];
  for (const { m, kind } of items) {
    const estadoPartido = matchHistoryEstadoPartidoHtml(official, m);
    if (kind === "group") {
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

      const predEnviada = matchHistoryPrediccionEnviadaHtml(predConfirmed);
      const ptsTd =
        pts == null
          ? '<td class="match-history-pts"><span class="muted">—</span></td>'
          : matchHistoryPointsTdHtml(pts, breakdown, scoring, officialComplete, predConfirmed, groupMatchMaxPts[m.id] ?? 0);

      rows.push(`<tr>
      <td>Grupo ${escapeHtml(m.groupId)}</td>
      <td>${teamLabelHtml(m.home)} <span class="vs">vs</span> ${teamLabelHtml(m.away)}</td>
      <td>${estadoPartido}</td>
      <td>${predEnviada}</td>
      <td>${formatPredScoreCell(pred)}</td>
      <td>${formatOfficialScoreCell(off, officialComplete)}</td>
      ${ptsTd}
    </tr>`);
    } else {
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
      const koPenPh = knockoutRoundRequiresPenaltyPickOnDraw(m.roundId);
      const pts =
        officialComplete && predConfirmed
          ? computeGroupMatchPoints(off, pred, improbableSign, scoring, koPenPh)
          : null;
      const breakdown =
        officialComplete && predConfirmed
          ? computeGroupMatchPointsBreakdown(off, pred, improbableSign, scoring, koPenPh)
          : null;
      if (pts != null) total += pts;
      if (officialComplete && predConfirmed) {
        totalPossible += scoring.maxPerMatch;
      }

      const { ri, mi } = getKoRoundMatchIndex(m.id);
      const homeLab = resolveKnockoutSlotLabel(ri, mi, "home", pStore.knockoutScores ?? {});
      const awayLab = resolveKnockoutSlotLabel(ri, mi, "away", pStore.knockoutScores ?? {});
      const predEnviada = matchHistoryPrediccionEnviadaHtml(predConfirmed);
      const ptsTd =
        pts == null
          ? '<td class="match-history-pts"><span class="muted">—</span></td>'
          : matchHistoryPointsTdHtml(pts, breakdown, scoring, officialComplete, predConfirmed, koMatchMaxPts[m.id] ?? 0);

      rows.push(`<tr>
      <td>${escapeHtml(knockoutPhaseTitle(m.roundId))}</td>
      <td>${bracketTeamLineHtml(homeLab)} <span class="vs">vs</span> ${bracketTeamLineHtml(awayLab)}</td>
      <td>${estadoPartido}</td>
      <td>${predEnviada}</td>
      <td>${formatPredScoreCell(pred, m.roundId)}</td>
      <td>${formatOfficialScoreCell(off, officialComplete, m.roundId)}</td>
      ${ptsTd}
    </tr>`);
    }
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
    body.innerHTML = "";
    totals.textContent = "";
    return;
  }
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
  sel.classList.add("partidos-scope-filter");
  sel.innerHTML = `
    <option value="${PARTIDOS_VISTA_SIGUIENTES_VALUE}">SIGUIENTES PARTIDOS</option>
    <option value="${PARTIDOS_VISTA_TERMINADOS_VALUE}">PARTIDOS TERMINADOS</option>
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
    if (sel.value === PARTIDOS_VISTA_SIGUIENTES_VALUE) {
      try {
        sessionStorage.setItem(PARTIDOS_NAV_PROXIMOS_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    } else {
      try {
        sessionStorage.removeItem(PARTIDOS_NAV_PROXIMOS_SESSION_KEY);
      } catch {
        /* ignore */
      }
      localStorage.setItem(PARTIDOS_SCOPE_KEY, sel.value);
    }
    syncPartidosScopeSelectUi();
    setPartidosGroupToolbarVisible(shouldShowPartidosGroupToolbar());
    redrawQuiniela();
  });
  sel.dataset.ready = "1";
  const saved = getPartidosUnderlyingScope();
  if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
  syncPartidosScopeSelectUi();
  setPartidosGroupToolbarVisible(shouldShowPartidosGroupToolbar());
}

/**
 * Estado del partido en la quiniela (visible para todos).
 * @param {"ready"|"started"|"finished"} matchStage
 * @param {boolean} officialConfirmed
 * @param {boolean} [groupTeamsDecided=true]
 */
function quinielaMatchStatusBanner(matchStage, officialConfirmed, groupTeamsDecided = true) {
  if (matchStage === "ready") {
    if (groupTeamsDecided === false) {
      return `<p class="quiniela-match-status quiniela-match-status--pending" role="status"><strong>Equipos por definir.</strong> Las predicciones están bloqueadas hasta que ambos equipos del partido estén fijados (sin «Por determinar»).</p>`;
    }
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
function renderQuinielaMatchCard(m, session, official, isAdmin, nextJornadaIds) {
  const canForceUndecidedMatches = canEditAllParticipantsPredictions(session.participantId);
  const groupTeamsDecided = isQuinielaTeamSlotDecided(m.home) && isQuinielaTeamSlotDecided(m.away);
  const off = official.groupScores[m.id] ?? { home: "", away: "" };
  const matchStage = official.groupMatchState?.[m.id] ?? "ready";
  const officialConfirmed = matchStage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
  const bothFilled = off.home !== "" && off.away !== "";
  /** Marcador visible para todos cuando el partido está en juego o ya cerrado confirmado. */
  const showPublicOfficialScore = bothFilled && (matchStage === "started" || officialConfirmed);
  const officialScoresOutcomeStyled = officialConfirmed && bothFilled;
  const offScoreHomeCls = officialScoresOutcomeStyled ? officialScoreOutcomeClass(off.home, off.away, "home") : "";
  const offScoreAwayCls = officialScoresOutcomeStyled ? officialScoreOutcomeClass(off.home, off.away, "away") : "";
  const adminCanEditOfficial = matchStage === "started";
  const body = buildQuinielaPredRowsHtml(m, session, official, isAdmin);
  const pStorePrev = loadPredictions(session.participantId);
  const userPredConfirmed = isUserPredictionConfirmedStore(pStorePrev, m);
  const matchClosed = isMatchOfficiallyClosed(official, m);
  const matchInProgress = matchStage === "started";
  const cornerHtml = partidosMatchCornerHtml(m, nextJornadaIds, userPredConfirmed, matchClosed, matchInProgress);
  const noKickHtml = partidosAccNoKickoffHintHtml(m);
  const officialPreview = partidosOfficialPreviewLineGroup(m, official);
  const predInlineHtml = !m.kickoff
    ? `<div class="partidos-acc__pred-row">${partidosUserPredPillHtml(userPredConfirmed, "inline", matchClosed)}</div>`
    : "";
  const kickCls = m.kickoff ? " partidos-match-card--has-kickoff" : "";

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
          <div class="quiniela-cell quiniela-cell--score${offScoreHomeCls}">${vh}</div>
          <div class="quiniela-cell quiniela-cell--score${offScoreAwayCls}">${va}</div>
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
        <p class="quiniela-official-hint muted">Partido iniciado: el admin puede ajustar el marcador oficial hasta terminarlo.</p>
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
          <button type="button" class="btn btn-primary btn-sm quiniela-btn-iniciar-partido" data-mid="${escapeHtml(m.id)}" ${groupTeamsDecided || canForceUndecidedMatches ? "" : "disabled"}>Iniciar partido</button>
        </div>
        <p class="quiniela-official-hint muted">${
          groupTeamsDecided
            ? "Antes de iniciar, todos pueden editar/confirmar su predicción. El admin aún no puede cambiar el marcador oficial."
            : canForceUndecidedMatches
              ? "Modo pruebas ADMIN: puedes iniciar y cargar marcador oficial aunque falten equipos por definir."
              : "No se puede iniciar el partido oficial mientras falte definir alguno de los dos equipos del cruce."
        }</p>
      </div>`;
    }
  } else {
    officialHtml = `
      <div class="quiniela-official">
        <div class="quiniela-official-head">Resultado oficial</div>
        <div class="quiniela-official-grid quiniela-official-grid--readonly">
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.home)}</div>
          <div class="quiniela-cell quiniela-cell--score${showPublicOfficialScore ? offScoreHomeCls : ""}">${showPublicOfficialScore ? vh : "—"}</div>
          <div class="quiniela-cell quiniela-cell--score${showPublicOfficialScore ? offScoreAwayCls : ""}">${showPublicOfficialScore ? va : "—"}</div>
          <div class="quiniela-cell quiniela-cell--team">${teamLabelHtml(m.away)}</div>
        </div>
      </div>`;
  }

  const sig = nextJornadaIds.has(m.id) && !matchInProgress ? " partidos-card--siguiente" : "";
  const enJuegoCls = matchInProgress ? " partidos-card--en-juego" : "";
  const oficialPendienteCls = !matchClosed ? " partidos-card--oficial-pendiente" : "";
  const oficialCerradoCls = matchClosed ? " partidos-card--oficial-cerrado" : "";
  const quinielaPredsLastTh =
    matchStage !== "ready"
      ? `<th class="quiniela-num quiniela-last-col" scope="col">Pts</th>`
      : `<th class="quiniela-num quiniela-last-col quiniela-last-col--preplay" scope="col"><span class="visually-hidden">Confirmar o cambiar predicción</span></th>`;
  const quinielaPredsTableCls =
    matchStage === "ready" ? "table table-compact quiniela-preds quiniela-preds--preplay" : "table table-compact quiniela-preds";
  return `
    <article class="card quiniela-match partidos-match-card${kickCls}${sig}${enJuegoCls}${oficialPendienteCls}${oficialCerradoCls}" data-group="${escapeHtml(m.groupId)}" data-quiniela-mid="${escapeHtml(m.id)}">
      ${cornerHtml}
      <details class="partidos-acc">
        <summary class="partidos-acc__summary">
          <span class="partidos-acc__chev" aria-hidden="true"></span>
          <div class="partidos-acc__summary-main">
            <h2 class="partidos-acc__title quiniela-match-title">Grupo ${escapeHtml(m.groupId)} · ${teamLabelHtml(m.home)} <span class="vs">vs</span> ${teamLabelHtml(m.away)}</h2>
            ${noKickHtml}
            ${predInlineHtml}
            <div class="partidos-acc__official-preview">${officialPreview}</div>
          </div>
        </summary>
        <div class="partidos-acc__body">
          ${quinielaMatchStatusBanner(matchStage, officialConfirmed, groupTeamsDecided)}
          ${officialHtml}
          <div class="quiniela-preds-head">Predicciones</div>
          <div class="table-scroll quiniela-table-wrap">
            <table class="${quinielaPredsTableCls}">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th class="quiniela-num">${escapeHtml(m.home)}</th>
                  <th class="quiniela-num">${escapeHtml(m.away)}</th>
                  <th class="quiniela-num quiniela-ganador-col" scope="col">Ganador</th>
                  ${quinielaPredsLastTh}
                </tr>
              </thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        </div>
      </details>
    </article>`;
}

/**
 * @param {HTMLElement | null} wrap
 * @returns {Set<string>}
 */
function collectOpenPartidosAccordionIds(wrap) {
  const out = new Set();
  if (!wrap) return out;
  for (const art of wrap.querySelectorAll("article.quiniela-match[data-quiniela-mid]")) {
    const det = art.querySelector("details.partidos-acc");
    if (det instanceof HTMLDetailsElement && det.open && art.dataset.quinielaMid) {
      out.add(art.dataset.quinielaMid);
    }
  }
  return out;
}

/**
 * @param {HTMLElement | null} wrap
 * @param {Set<string>} ids
 */
function restoreOpenPartidosAccordions(wrap, ids) {
  if (!wrap || ids.size === 0) return;
  for (const mid of ids) {
    const art = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(mid)}"]`);
    const det = art?.querySelector("details.partidos-acc");
    if (det instanceof HTMLDetailsElement) det.open = true;
  }
}

/**
 * Si el foco está en Partidos (p. ej. stepper del 2.º partido abierto), tras `innerHTML` el navegador
 * suele enfocar el primer acordeón y subir el scroll. Guardamos tarjeta + selector para restaurar.
 * Los botones ± dejan el foco en `.score-stepper__btn`, no en el input: resolvemos al input del mismo stepper.
 * @param {HTMLElement | null} wrap
 * @returns {{ articleMid: string, focusSelector: string | null } | null}
 */
function capturePartidosInteractionAnchor(wrap) {
  if (!wrap) return null;
  let el = document.activeElement;
  if (!(el instanceof HTMLElement) || !wrap.contains(el)) return null;
  if (el.matches(".score-stepper__btn")) {
    const stepper = el.closest(".score-stepper");
    const inp = stepper?.querySelector(".score-stepper__input");
    if (inp instanceof HTMLInputElement) el = inp;
  }
  const art = el.closest("article.quiniela-match[data-quiniela-mid]");
  const articleMid = art?.dataset.quinielaMid ?? null;
  if (!articleMid) return null;
  if (el.matches(".ko-user-pen-pick")) {
    const kidPen = el.dataset.kidPen;
    const pid = el.dataset.pid;
    const pick = el.dataset.penPick;
    if (kidPen && pid && (pick === "home" || pick === "away")) {
      return {
        articleMid,
        focusSelector: `button.ko-user-pen-pick[data-kid-pen="${CSS.escape(kidPen)}"][data-pid="${CSS.escape(pid)}"][data-pen-pick="${CSS.escape(pick)}"]`,
      };
    }
    return { articleMid, focusSelector: null };
  }
  if (el.matches(".ko-official-pen-pick")) {
    const okidPen = el.dataset.okidPen;
    const penSide = el.dataset.penSide;
    if (okidPen && (penSide === "home" || penSide === "away")) {
      return {
        articleMid,
        focusSelector: `button.ko-official-pen-pick[data-okid-pen="${CSS.escape(okidPen)}"][data-pen-side="${CSS.escape(penSide)}"]`,
      };
    }
    return { articleMid, focusSelector: null };
  }
  if (!el.matches(".score-stepper__input")) {
    return { articleMid, focusSelector: null };
  }
  const side = el.dataset.side === "away" ? "away" : "home";
  let scope = "";
  if (el.closest(".quiniela-official.quiniela-official--admin.quiniela-official--editing")) {
    scope = ".quiniela-official.quiniela-official--admin.quiniela-official--editing ";
  } else if (el.closest(".partidos-ko-official.partidos-ko-official--editing")) {
    scope = ".partidos-ko-official.partidos-ko-official--editing ";
  } else if (el.closest("tr.quiniela-pred-edit-row")) {
    const row = el.closest("tr.quiniela-pred-edit-row");
    const sm = row?.dataset.quinielaSelfMid;
    const pid = row?.dataset.predPid;
    scope =
      sm && pid
        ? `tr.quiniela-pred-edit-row[data-quiniela-self-mid="${CSS.escape(sm)}"][data-pred-pid="${CSS.escape(pid)}"] `
        : "tr.quiniela-pred-edit-row ";
  } else if (el.closest("tr.partidos-ko-pred-edit-row")) {
    const row = el.closest("tr.partidos-ko-pred-edit-row");
    const kidRow = row?.dataset.partidosKoSelfKid;
    const pidKo = row?.dataset.predPid;
    scope =
      kidRow && pidKo
        ? `tr.partidos-ko-pred-edit-row[data-partidos-ko-self-kid="${CSS.escape(kidRow)}"][data-pred-pid="${CSS.escape(pidKo)}"] `
        : "tr.partidos-ko-pred-edit-row ";
  }
  const kid = el.getAttribute("data-kid");
  const midAttr = el.getAttribute("data-mid");
  const okid = el.getAttribute("data-okid");
  let tail = "";
  if (kid) {
    tail = `[data-kid="${CSS.escape(kid)}"][data-side="${side}"]`;
  } else if (okid) {
    tail = `[data-okid="${CSS.escape(okid)}"][data-side="${side}"]`;
  } else if (midAttr) {
    tail = `[data-mid="${CSS.escape(midAttr)}"][data-side="${side}"]`;
  } else {
    return { articleMid, focusSelector: null };
  }
  return { articleMid, focusSelector: `${scope}.score-stepper__input${tail}` };
}

/**
 * @param {HTMLElement | null} wrap
 * @param {{ articleMid: string, focusSelector: string | null } | null} anchor
 * @param {{ mid: string, vTop: number } | null} viewportLock distancia desde el borde superior del viewport a la tarjeta (antes del re-render)
 */
function restorePartidosInteractionAnchor(wrap, anchor, viewportLock) {
  if (!wrap || !anchor) return;
  const art = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(anchor.articleMid)}"]`);
  if (!art) return;
  const focusTarget = anchor.focusSelector ? art.querySelector(anchor.focusSelector) : null;

  function alignViewport() {
    if (!viewportLock) return;
    const a = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(viewportLock.mid)}"]`);
    if (!a) return;
    const dy = viewportLock.vTop - a.getBoundingClientRect().top;
    if (Math.abs(dy) > 0.5) window.scrollBy(0, dy);
  }

  requestAnimationFrame(() => {
    alignViewport();
    if (focusTarget instanceof HTMLElement) {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        focusTarget.focus();
      }
      if (focusTarget instanceof HTMLInputElement && typeof focusTarget.select === "function") {
        try {
          focusTarget.select();
        } catch {
          /* */
        }
      }
    }
    alignViewport();
    requestAnimationFrame(() => {
      alignViewport();
    });
  });
}

/**
 * @param {{ participantId: string } | null} session
 * @param {ReturnType<typeof loadOfficialResults>} official
 */
function renderQuiniela(session, official) {
  ensurePartidosScopeFilter();
  ensureQuinielaFilter();
  syncPartidosScopeSelectUi();
  const wrap = $("#quiniela-wrap");
  const intro = $("#partidos-intro");
  const loginHint = $("#partidos-intro-login");
  if (!wrap || !intro) return;

  if (!session) {
    if (loginHint) loginHint.hidden = false;
    wrap.innerHTML = "";
    return;
  }

  if (loginHint) loginHint.hidden = true;

  const isAdmin = canEditOfficialResults(session.participantId);
  const scope = getPartidosUnderlyingScope();
  const allCal = allMatchesForPartidosCalendar();
  const nextHighlightIds = getNextMatchDayHighlightIds(official, allCal);
  const showOnlyProximosNav = partidosSiguientesVistaActiva();
  const showTerminados = scope === PARTIDOS_VISTA_TERMINADOS_VALUE;
  setPartidosGroupToolbarVisible(shouldShowPartidosGroupToolbar());

  const blocks = [];
  if (showOnlyProximosNav) {
    /** Atajo del menú: la jornada próxima puede mezclar grupos y KO; no limitar por Vista ni por filtro de grupo. */
    let proximos = allCal.filter((m) => nextHighlightIds.has(m.id));
    proximos = sortPartidosBySiguientesThenKickoff(proximos, nextHighlightIds);
    for (const m of proximos) {
      if (m.groupId != null) {
        blocks.push(renderQuinielaMatchCard(m, session, official, isAdmin, nextHighlightIds));
      } else {
        blocks.push(renderQuinielaMatchCardKo(m, session, official, isAdmin, nextHighlightIds));
      }
    }
  } else if (showTerminados) {
    const noNextHighlight = new Set();
    let terminados = allCal.filter((m) => isMatchOfficiallyClosed(official, m));
    terminados = [...terminados].sort((a, b) => {
      const ta = a.kickoff ? Date.parse(a.kickoff) : 0;
      const tb = b.kickoff ? Date.parse(b.kickoff) : 0;
      if (tb !== ta) return tb - ta;
      return String(a.id).localeCompare(String(b.id));
    });
    for (const m of terminados) {
      if (m.groupId != null) {
        blocks.push(renderQuinielaMatchCard(m, session, official, isAdmin, noNextHighlight));
      } else {
        blocks.push(renderQuinielaMatchCardKo(m, session, official, isAdmin, noNextHighlight));
      }
    }
  } else if (scope === "grupos") {
    const filterEl = $("#quiniela-group-filter");
    const groupFilter = filterEl?.value ?? "";
    let matches = groupFilter ? GROUP_MATCHES.filter((m) => m.groupId === groupFilter) : GROUP_MATCHES;
    matches = sortPartidosBySiguientesThenKickoff(matches, nextHighlightIds);
    blocks.push(...matches.map((m) => renderQuinielaMatchCard(m, session, official, isAdmin, nextHighlightIds)));
  } else {
    let koList = getKnockoutMatchesFlat();
    if (scope !== "all-ko") koList = koList.filter((x) => x.roundId === scope);
    koList = sortPartidosBySiguientesThenKickoff(koList, nextHighlightIds);
    blocks.push(...koList.map((m) => renderQuinielaMatchCardKo(m, session, official, isAdmin, nextHighlightIds)));
  }
  const openAccordionMatchIds = collectOpenPartidosAccordionIds(wrap);
  const partidosInteractionAnchor = capturePartidosInteractionAnchor(wrap);
  const partidosViewportLock =
    partidosInteractionAnchor?.articleMid
      ? (() => {
          const ae = wrap.querySelector(
            `article.quiniela-match[data-quiniela-mid="${CSS.escape(partidosInteractionAnchor.articleMid)}"]`,
          );
          return ae ? { mid: partidosInteractionAnchor.articleMid, vTop: ae.getBoundingClientRect().top } : null;
        })()
      : null;
  wrap.innerHTML =
    blocks.length === 0 && showOnlyProximosNav
      ? `<p class="muted partidos-proximos-empty">No hay partidos de la <strong>jornada próxima</strong> en esta vista. Cambia <strong>Vista</strong> o el grupo, o entra desde <strong>Partidos</strong> para ver el listado completo.</p>`
      : blocks.length === 0 && showTerminados
        ? `<p class="muted partidos-proximos-empty">Aún no hay partidos con <strong>resultado oficial confirmado</strong>. Cuando el admin cierre partidos, aparecerán aquí.</p>`
        : blocks.join("");

  wireQuinielaPredictionHandlersInScope(wrap, session);
  syncQuinielaPerfectBonusCanvases(wrap);
  syncGroupPtsBadgeCanvases(wrap);

  if (isAdmin) bindPartidosAdminHandlers(wrap, session);

  if (blocks.length > 0) restoreOpenPartidosAccordions(wrap, openAccordionMatchIds);
  restorePartidosInteractionAnchor(wrap, partidosInteractionAnchor, partidosViewportLock);

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

/** Marcadores que cuentan para puntos de quiniela: partido en juego o final con resultado confirmado. */
function getOfficialGroupScoresForLiveQuinielaPoints() {
  const off = loadOfficialResults();
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

function teamStatsSourceOptionsHtml() {
  const options = ['<option value="official">Resultado oficial</option>'];
  for (const p of getParticipantsForDisplay()) {
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
  left.value = savedLeft && valid(savedLeft) ? savedLeft : "official";
  if (savedRight && valid(savedRight)) {
    right.value = savedRight;
  } else if (defaultParticipantId && valid(defaultParticipantId)) {
    right.value = defaultParticipantId;
  } else {
    right.value = left.options[0]?.value ?? "official";
  }
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
  for (const p of getParticipantsForDisplay()) {
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
    const thirdAdvanceHit =
      hasOfficialData &&
      officialThirdDefined &&
      (predThird === true || predThird === false) &&
      predThird === officialThird;
    let groupBadge = "";
    if (fullOrderHit && thirdAdvanceHit) {
      groupBadge = `<span class="team-order-inline-bonus"><span class="group-preds-perfecto-label">Perfecto</span>${pointsBadgeHtml(perfectOrderPts + GROUP_PERFECTO_ORDER_AND_THIRD_BONUS, {
        title: `+${GROUP_QUALIFIERS_ORDER_BONUS} por orden de 1.º y 2.º, +${GROUP_PERFECT_ORDER_BONUS} por el grupo completo y +${GROUP_PERFECTO_ORDER_AND_THIRD_BONUS} por acierto de 3.º pasa`,
      })}</span>`;
    } else if (fullOrderHit) {
      groupBadge = `<span class="team-order-inline-bonus"><span class="group-preds-excelente-label">Excelente</span>${pointsBadgeHtml(perfectOrderPts, {
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
  const loginHint = $("#team-stats-intro-login");
  const officialBody = $("#table-team-stats-official-body");
  const predBody = $("#table-team-stats-pred-body");
  const officialSub = $("#team-stats-subtitle-official");
  const predSub = $("#team-stats-subtitle-pred");
  const compareWrap = $("#team-stats-compare");
  const panel = $("#panel-team-stats");
  const session = loadSession();

  if (!intro || !officialBody || !predBody) return;

  if (!session) {
    if (loginHint) loginHint.hidden = false;
    officialBody.innerHTML = "";
    predBody.innerHTML = "";
    if (officialSub) officialSub.textContent = "Fase de grupos · Resultado oficial";
    if (predSub) predSub.textContent = "Fase de grupos · Predicción";
    compareWrap?.classList.remove("team-stats-compare--self-selected");
    return;
  }

  if (loginHint) loginHint.hidden = true;

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

/**
 * Celda numérica del ranking de orden de grupos.
 * @param {number} count
 * @param {string} title
 * @param {boolean} isTopInColumn
 * @param {"bien"|"excelente"|"perfecto"|"bonus"} kind
 */
function groupOrderRankingStatCell(count, title, isTopInColumn, kind) {
  const topCls = isTopInColumn ? `group-ranking-stat--top group-ranking-stat--top-${kind}` : "";
  return `<td class="group-ranking-stat ${topCls}" title="${escapeHtml(title)}"><span class="group-ranking-stat-num">${count}</span></td>`;
}

function buildGroupOrderRankingRows(sessionParticipantId) {
  const officialSnapshot = getLiveOfficialGroupSnapshot();
  const rows = getParticipantsForDisplay().map((p) => {
    const pStore = loadPredictions(p.id);
    let bienCount = 0;
    let excelenteCount = 0;
    let perfectoBonusCount = 0;
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
      const thirdAdvanceHit =
        officialThirdDefined &&
        (predThird === true || predThird === false) &&
        predThird === officialThird;

      // Badge único por grupo (prioridad): PERFECTO > EXCELENTE > BIEN.
      if (fullOrderHit && thirdAdvanceHit) {
        perfectoBonusCount += 1;
      } else if (fullOrderHit) {
        excelenteCount += 1;
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
    return { participant: p, bienCount, excelenteCount, perfectoBonusCount, bonusCount, totalPoints };
  });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.excelenteCount !== a.excelenteCount) return b.excelenteCount - a.excelenteCount;
    if (b.perfectoBonusCount !== a.perfectoBonusCount) return b.perfectoBonusCount - a.perfectoBonusCount;
    if (b.bonusCount !== a.bonusCount) return b.bonusCount - a.bonusCount;
    if (b.bienCount !== a.bienCount) return b.bienCount - a.bienCount;
    return a.participant.name.localeCompare(b.participant.name);
  });

  const maxBien = Math.max(0, ...rows.map((r) => r.bienCount));
  const maxExcelente = Math.max(0, ...rows.map((r) => r.excelenteCount));
  const maxPerfecto = Math.max(0, ...rows.map((r) => r.perfectoBonusCount));
  const maxBonus = Math.max(0, ...rows.map((r) => r.bonusCount));
  const maxPts = Math.max(0, ...rows.map((r) => r.totalPoints));

  return rows
    .map((r, idx) => {
      const isSelf = r.participant.id === sessionParticipantId;
      const podium = idx === 0 ? "group-ranking-row--gold" : idx === 1 ? "group-ranking-row--silver" : idx === 2 ? "group-ranking-row--bronze" : "";
      const rowCls = ["group-ranking-row", podium, isSelf ? "row-self" : ""].filter(Boolean).join(" ");
      const rank = idx + 1;
      const you = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      return `<tr class="${rowCls}">
        <td class="group-ranking-rank">${rank}</td>
        <th scope="row" class="group-ranking-name">${escapeHtml(r.participant.name)}${you}</th>
        ${groupOrderRankingStatCell(
          r.bienCount,
          "BIEN: grupos con 1.º y 2.º en orden exacto (+2).",
          maxBien > 0 && r.bienCount === maxBien,
          "bien",
        )}
        ${groupOrderRankingStatCell(
          r.excelenteCount,
          "EXCELENTE: grupos con orden 1.º a 4.º exacto (+2, badge único del grupo).",
          maxExcelente > 0 && r.excelenteCount === maxExcelente,
          "excelente",
        )}
        ${groupOrderRankingStatCell(
          r.perfectoBonusCount,
          "PERFECTO: grupos con orden completo y acierto de si el 3.º pasa (+1).",
          maxPerfecto > 0 && r.perfectoBonusCount === maxPerfecto,
          "perfecto",
        )}
        ${groupOrderRankingStatCell(
          r.bonusCount,
          "BONO: aciertos en posición con pick minoritario (+1 c/u).",
          maxBonus > 0 && r.bonusCount === maxBonus,
          "bonus",
        )}
        <td class="group-ranking-num group-ranking-total ${maxPts > 0 && r.totalPoints === maxPts ? "group-ranking-total--top" : ""}"><strong>${r.totalPoints}</strong></td>
      </tr>`;
    })
    .join("");
}

function redrawTeamOrderRanking() {
  const body = $("#table-team-order-ranking-body");
  const session = loadSession();
  if (!body) return;
  if (!session) {
    body.innerHTML = "";
    return;
  }
  body.innerHTML = buildGroupOrderRankingRows(session.participantId);
}

/**
 * @param {{ participantId: string } | null} session
 * @param {{ skipPartidosRender?: boolean }} [opts]
 */
function refreshAll(session, opts = {}) {
  const { skipPartidosRender = false } = opts;
  if (session) {
    const p = getParticipantById(session.participantId);
    if (p && p.pin != null && p.pin !== "" && !isPinVerified(p.id, p.pin)) {
      clearSession();
      session = null;
      window.dispatchEvent(new CustomEvent("pm26-pin-stale"));
    }
  }
  if (session) {
    resetCompareTableSourcesIfParticipantChanged(session.participantId);
  } else {
    clearCompareTableParticipantBinding();
  }
  updateSessionBar(session);
  renderStats(session);
  renderFloatingRanking(session);
  ensureFaseGruposFilter();
  if (!session) {
    syncFaseGruposFilterOptions(null);
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
    redrawTeamStats();
    $("#table-team-order-official-body").innerHTML = "";
    $("#table-team-order-pred-body").innerHTML = "";
    $("#table-team-order-ranking-body").innerHTML = "";
    $("#table-match-ranking-body").innerHTML = "";
    $("#table-match-history-body").innerHTML = "";
    $("#table-final-ranking-body").innerHTML = "";
    renderFinalRanking(null);
    redrawMatchRanking();
    renderQuiniela(null, loadOfficialResults());
    updateProximosNavShortcutButton(null);
    updatePredictionTabsProgress(null, null);
    syncGroupPtsBadgeCanvases(document.body);
    return;
  }
  const predictions = loadPredictions(session.participantId);
  updatePredictionTabsProgress(session, predictions);
  renderGenerales(session.participantId, predictions, false);
  renderGrupos(session.participantId, predictions);
  renderBrackets(session.participantId, predictions);
  redrawTeamStats();
  redrawTeamOrder();
  redrawTeamOrderRanking();
  redrawMatchRanking();
  redrawMatchHistory();
  renderFinalRanking(session);
  if (!skipPartidosRender) {
    renderQuiniela(session, loadOfficialResults());
  }
  updateProximosNavShortcutButton(session);
  rebuildTeamStatsSelectOptions();
  rebuildTeamOrderSelectOptions();
  syncGroupPtsBadgeCanvases(document.body);
}

export function initApp() {
  initGroupPtsBadgeCanvasObserver();
  updateSyncLiveBadge();
  bindGeneralesPointsHelpOverlay();
  bindGruposOrderHelpOverlay();
  bindPartidosPointsHelpOverlay();
  bindGeneralesOfficialAdminActions();
  initNavDrawer();
  initFloatingRanking();
  ensureFaseGruposFilter();
  tabsController = initTabs((tabId) => {
    syncDrawerExpandableSubmenus(tabId);
    if (tabId === "partidos") redrawQuiniela();
    if (tabId === "team-stats") redrawTeamStats();
    if (tabId === "team-order") redrawTeamOrder();
    if (tabId === "team-order-ranking") redrawTeamOrderRanking();
    if (tabId === "match-ranking") redrawMatchRanking();
    if (tabId === "match-history") redrawMatchHistory();
    if (tabId === "final-ranking") renderFinalRanking(loadSession());
  });
  initDrawerExpandableSubmenus(tabsController);
  bindRulesQuickButton();

  /** Evita solapar varios refreshAll (WS + pestañas); reentrancia rompe el DOM y bloquea la UI. */
  let externalSyncRefreshChain = Promise.resolve();

  function queueRefreshAfterExternalSync() {
    externalSyncRefreshChain = externalSyncRefreshChain
      .then(() => {
        refreshAll(loadSession());
      })
      .catch((err) => {
        console.error("[pm26] refresh tras sincronización externa", err);
      });
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== "pm26-official-results") return;
    queueRefreshAfterExternalSync();
  });

  window.addEventListener("pm26-remote-sync", () => {
    queueRefreshAfterExternalSync();
  });

  function afterSessionReady() {
    refreshAll(loadSession());
  }

  window.addEventListener("pm26-pin-stale", () => {
    showOnboarding(afterSessionReady);
  });

  bindAdminSettings(afterSessionReady);
  bindParticipantAccentPopover();

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
    refreshAll(null);
  }

  requestAnimationFrame(() => syncGroupPtsBadgeCanvases(document.body));
}
