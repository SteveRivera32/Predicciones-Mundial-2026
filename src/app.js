import {
  getParticipants,
  getParticipantsForDisplay,
  getParticipantsForListDisplay,
  getArenaParticipantsListMeta,
  orderRankingRowsForDisplay,
  getParticipantSearchQuery,
  setParticipantSearchQuery,
  cycleParticipantSortMode,
  participantSortModeLabel,
  getParticipantSortMode,
  getParticipantById,
  getParticipantAccentHex,
  getParticipantDisplayHue,
  setParticipantColor,
  hasParticipantCustomAccent,
  hexToRgb,
  canEditOfficialResults,
  canManagePartidosMatchFlow,
  canEditAllParticipantsPredictions,
  canAdminEditLateMatchPredictions,
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
  mergePredictionsFromRemote,
  getAllPredictionsMap,
} from "./predictions-store.js";
import { loadOfficialResults, saveOfficialResults, clearOfficialResultsStorage } from "./official-results-store.js";
import { isRemoteSyncActive } from "./remote-sync-flags.js";
import {
  isArenaMode,
  isArenaPrivadasMirrorUser,
  isArenaAdmin,
  getArenaUser,
  arenaGeneralesGroupsDeadlineMs,
  arenaGeneralesGroupsDeadlineDateLabelSpanish,
  formatArenaGeneralesGroupsCountdown,
  isArenaGeneralesAndGroupsLocked,
  arenaLogout,
  arenaDeleteMyAccount,
  arenaAdminListUsers,
  arenaAdminDeleteUser,
  arenaAdminBanUser,
  arenaAdminListBackups,
  arenaAdminExportBackup,
  arenaAdminRestoreBackupFile,
  arenaAdminRestoreBackupUpload,
  isArenaInteractionPaused,
  bumpArenaInteraction,
  scheduleArenaDeferredRefresh,
  getArenaServerRankings,
  arenaSearchPredictions,
  hasArenaMatchVoteData,
  getArenaMatchOutcomeCounts,
  getArenaImprobableOutcomeSign,
  getArenaClosestScoreBonusIds,
  getArenaKnockoutPenaltyCounts,
  getArenaGroupOrderVoteCountsByPosition,
  getArenaGroupThirdAdvanceVoteCounts,
  getArenaGeneralesVoteCountsBySlot,
} from "./arena-mode.js";
import {
  computeLiveParticipantRowsFromData,
  ARENA_PRELAUNCH_EXCLUDED_GROUP_MATCH_IDS,
} from "./live-ranking.js";
import { sortByRankingTiebreak, compareRankingRows } from "./ranking-tiebreak.js";
import { applyRemoteState } from "./sync.js";
import { pushResetQuiniela, fetchBackupsList, restoreServerBackup, pushPredictions } from "./sync-push.js";
import { downloadBackupFile, restoreFromBackupFile } from "./backup.js";
import { normalizeForSearch } from "./search-normalize.js";
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
  GROUP_PERFECTO_ORDER_AND_THIRD_BONUS,
  GROUP_PERFECT_ORDER_BONUS,
  GROUP_QUALIFIERS_ORDER_BONUS,
  INDIVIDUAL_AWARD_POINTS,
  MAX_PER_GROUP,
  MATCH_SCORING,
  normalizeAwardText,
} from "./scoring-rules.js";
import { getSquadEntriesByRole, SQUAD_ENTRIES } from "./award-nominees.js";
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
  normalizeTeamName,
} from "./tournament.js";
import {
  isLockedAtKickoff,
  isGroupMatchPredictionsLocked,
  isKoMatchPredictionsLocked,
  isMatchPredictionLockedForActor,
  isAnyTournamentMatchKickoffLocked,
} from "./locks.js";
import {
  applyKickoffAutoStarts,
  confirmPendingPredictionsForGroupMatch,
  confirmPendingPredictionsForKoMatch,
  scheduleKickoffAutoStartRefresh,
} from "./kickoff-autostart.js";
import {
  formatKickoffShortSpanish,
  formatKickoffDayLabelSpanish,
  calendarDayKeyForKickoff,
  countdownLabelSpanish,
  getNextMatchDayHighlightIds,
  daysUntilKickoffLocal,
  isMatchOfficiallyClosed,
  isMatchLiveInPlay,
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
/** Vista del panel historial: tabla con puntos o predicciones por fecha. */
const MATCH_HISTORY_VIEW_KEY = "pm26-match-history-view";
const TEAM_STATS_LEFT_SOURCE_KEY = "pm26-team-stats-left-source";
const TEAM_STATS_RIGHT_SOURCE_KEY = "pm26-team-stats-right-source";
const TEAM_STATS_VIEW_KEY = "pm26-team-stats-view";
const TEAM_STATS_SINGLE_PTS_KEY = "pm26-team-stats-single-pts";
const TEAM_STATS_COMPARE_VIEW_KEY = "pm26-team-stats-compare-view";
const TEAM_STATS_LAYOUT_KEY = "pm26-team-stats-layout";
const TEAM_STATS_SINGLE_SOURCE_KEY = "pm26-team-stats-single-source";
const TEAM_ORDER_LEFT_SOURCE_KEY = "pm26-team-order-left-source";
const TEAM_ORDER_RIGHT_SOURCE_KEY = "pm26-team-order-right-source";
const TEAM_ORDER_LAYOUT_KEY = "pm26-team-order-layout";
const TEAM_ORDER_SINGLE_SOURCE_KEY = "pm26-team-order-single-source";
const TEAM_ORDER_SINGLE_PTS_KEY = "pm26-team-order-single-pts";
/** Último participante con sesión: si cambia, se reinician tablas comparadas (oficial | tú). */
const COMPARE_TABLES_BOUND_PARTICIPANT_KEY = "pm26-compare-tables-bound-participant";
const STATS_COLOR_HINT_DISMISSED_KEY = "pm26-stats-color-hint-dismissed-v3";
const FASE_GRUPOS_FILTER_KEY = "pm26-fase-grupos-gid";
const FLOATING_RANK_POS_KEY = "pm26-floating-rank-pos";
const FLOATING_RANK_ENABLED_KEY = "pm26-floating-rank-enabled";
/** Agrupa refrescos de ranking/stats tras ráfagas de clics en steppers (mejora INP). */
const DEFERRED_GLOBAL_RANKINGS_MS = 120;
/** @type {ReturnType<typeof setTimeout> | null} */
let deferredGlobalRankingsTimer = null;
const MOBILE_LAYOUT_MQ =
  typeof window !== "undefined" ? window.matchMedia("(max-width: 40rem)") : null;
/** Tras +/- en partidos, evita re-render completo (eco WS) que cierra y reabre acordeones. */
let partidosFullRenderMutedUntil = 0;
const PARTIDOS_FULL_RENDER_MUTE_MS = 2200;

/** @returns {boolean} */
function isMobileLayout() {
  return MOBILE_LAYOUT_MQ?.matches === true;
}

function mutePartidosFullRenderAfterLocalEdit() {
  partidosFullRenderMutedUntil = Date.now() + PARTIDOS_FULL_RENDER_MUTE_MS;
}

/** @returns {boolean} */
function shouldMutePartidosFullRender() {
  return Date.now() < partidosFullRenderMutedUntil;
}
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
    localStorage.setItem(TEAM_STATS_SINGLE_SOURCE_KEY, participantId);
    localStorage.setItem(TEAM_ORDER_LEFT_SOURCE_KEY, "official");
    localStorage.setItem(TEAM_ORDER_RIGHT_SOURCE_KEY, participantId);
    localStorage.setItem(TEAM_ORDER_SINGLE_SOURCE_KEY, participantId);
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
  const name = normalizeTeamName(teamName);
  return BRACKET_KNOWN_TEAMS.has(name) && !isPlaceholderTeam(name);
}

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
  if (isArenaMode() && hasArenaMatchVoteData()) {
    return getArenaGroupOrderVoteCountsByPosition(groupId);
  }
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

/** @param {string} matchId @param {boolean} isKo */
function getMatchOutcomeVoteCounts(matchId, isKo) {
  if (isArenaMode() && hasArenaMatchVoteData()) {
    return getArenaMatchOutcomeCounts(matchId, isKo);
  }
  const votes = isKo
    ? collectKnockoutOutcomeVotesForMatch(matchId)
    : collectOutcomeVotesForMatch(matchId);
  /** @type {{ h: number, d: number, a: number }} */
  const counts = { h: 0, d: 0, a: 0 };
  for (const s of votes) {
    if (s === "h" || s === "d" || s === "a") counts[s] += 1;
  }
  return counts;
}

/** @param {string} matchId */
function getKnockoutPenaltyVoteCounts(matchId) {
  if (isArenaMode() && hasArenaMatchVoteData()) {
    return getArenaKnockoutPenaltyCounts(matchId);
  }
  return collectKnockoutPenaltyVotesForMatch(matchId);
}

/** @param {string} matchId */
function collectKnockoutPenaltyVotesForMatch(matchId) {
  /** @type {{ home: number, away: number }} */
  const counts = { home: 0, away: 0 };
  for (const part of getParticipantsForDisplay()) {
    const store = loadPredictions(part.id);
    if (store.knockoutScoresConfirmed?.[matchId] !== true) continue;
    const pred = store.knockoutScores?.[matchId] ?? {};
    if (predictionOutcomeSign(pred) !== "d") continue;
    if (pred.penaltyWinner === "home") counts.home += 1;
    else if (pred.penaltyWinner === "away") counts.away += 1;
  }
  return counts;
}

/**
 * @param {{ homeName: string, awayName: string, counts: { h: number, d: number, a: number }, teamLabelKind?: "team" | "bracket" }} opts
 */
function buildMatchOutcomeVoteBarHtml(opts) {
  const { homeName, awayName, counts, teamLabelKind = "team" } = opts;
  const total = counts.h + counts.d + counts.a;
  if (total <= 0) return "";

  /** @param {"h"|"d"|"a"} key @param {string} name */
  const labelFor = (key, name) => {
    if (key === "d") return '<span class="match-outcome-vote__draw-label">Empate</span>';
    if (teamLabelKind === "bracket") return bracketTeamLineHtml(name);
    return teamLabelHtml(name);
  };

  const segments = [
    { key: "h", n: counts.h, cls: "home", name: homeName, align: "home" },
    { key: "d", n: counts.d, cls: "draw", name: "Empate", align: "draw" },
    { key: "a", n: counts.a, cls: "away", name: awayName, align: "away" },
  ];

  const barSegs = segments
    .map((s) => {
      const pct = (s.n / total) * 100;
      return `<span class="match-outcome-vote__seg match-outcome-vote__seg--${s.cls}${pct <= 0 ? " match-outcome-vote__seg--empty" : ""}" style="width:${pct.toFixed(2)}%" title="${formatVotePercent(s.n, total)}"></span>`;
    })
    .join("");

  const legendCells = segments
    .map(
      (s) => `<div class="match-outcome-vote__legend-cell match-outcome-vote__legend-cell--${s.align}">
      <span class="match-outcome-vote__dot match-outcome-vote__dot--${s.cls}" aria-hidden="true"></span>
      <span class="match-outcome-vote__legend-label">${labelFor(/** @type {"h"|"d"|"a"} */ (s.key), s.name)}</span>
      <span class="match-outcome-vote__legend-pct">${formatVotePercent(s.n, total)}</span>
    </div>`,
    )
    .join("");

  return `<div class="match-outcome-vote" aria-label="Distribución de predicciones de resultado">
    <div class="match-outcome-vote__bar" role="img" aria-hidden="true">${barSegs}</div>
    <div class="match-outcome-vote__legend">${legendCells}</div>
  </div>`;
}

/**
 * @param {string} homeName
 * @param {string} awayName
 * @param {string} matchId
 */
function buildKnockoutPenaltyVoteBarHtml(homeName, awayName, matchId) {
  const counts = getKnockoutPenaltyVoteCounts(matchId);
  const total = counts.home + counts.away;
  if (total <= 0) return "";

  const barSegs = [
    { n: counts.home, cls: "home" },
    { n: counts.away, cls: "away" },
  ]
    .map((s) => {
      const pct = (s.n / total) * 100;
      return `<span class="match-outcome-vote__seg match-outcome-vote__seg--${s.cls}${pct <= 0 ? " match-outcome-vote__seg--empty" : ""}" style="width:${pct.toFixed(2)}%" title="${formatVotePercent(s.n, total)}"></span>`;
    })
    .join("");

  const homeCell = `<div class="match-outcome-vote__legend-cell match-outcome-vote__legend-cell--home">
      <span class="match-outcome-vote__dot match-outcome-vote__dot--home" aria-hidden="true"></span>
      <span class="match-outcome-vote__legend-label">${bracketTeamLineHtml(homeName)}</span>
      <span class="match-outcome-vote__legend-pct">${formatVotePercent(counts.home, total)}</span>
    </div>`;
  const awayCell = `<div class="match-outcome-vote__legend-cell match-outcome-vote__legend-cell--away">
      <span class="match-outcome-vote__dot match-outcome-vote__dot--away" aria-hidden="true"></span>
      <span class="match-outcome-vote__legend-label">${bracketTeamLineHtml(awayName)}</span>
      <span class="match-outcome-vote__legend-pct">${formatVotePercent(counts.away, total)}</span>
    </div>`;

  return `<div class="match-outcome-vote match-outcome-vote--penalties" aria-label="Distribución de ganador en penales entre quienes predicen empate">
    <p class="match-outcome-vote__subtitle muted">Penales <span class="match-outcome-vote__subtitle-note">(entre quienes predicen empate)</span></p>
    <div class="match-outcome-vote__bar" role="img" aria-hidden="true">${barSegs}</div>
    <div class="match-outcome-vote__legend">${homeCell}<div class="match-outcome-vote__legend-spacer" aria-hidden="true"></div>${awayCell}</div>
  </div>`;
}

/** @param {string} homeName @param {string} awayName @param {string} matchId @param {boolean} isKo @param {string} [roundId] */
function buildMatchVoteBarsHtml(homeName, awayName, matchId, isKo, roundId = "") {
  if (!isArenaMode()) return "";
  const outcomeHtml = buildMatchOutcomeVoteBarHtml({
    homeName,
    awayName,
    counts: getMatchOutcomeVoteCounts(matchId, isKo),
    teamLabelKind: isKo ? "bracket" : "team",
  });
  const penaltyHtml =
    isKo && knockoutRoundRequiresPenaltyPickOnDraw(roundId)
      ? buildKnockoutPenaltyVoteBarHtml(homeName, awayName, matchId)
      : "";
  if (!outcomeHtml && !penaltyHtml) return "";
  return `<div class="match-vote-bars">${outcomeHtml}${penaltyHtml}</div>`;
}

function getImprobableOutcomeSignForMatch(matchId, officialScore) {
  if (isArenaMode() && hasArenaMatchVoteData()) {
    return getArenaImprobableOutcomeSign(matchId, false);
  }
  return getUniqueOfficialOutcomeBonusSign(collectOutcomeVotesForMatch(matchId), officialScore);
}

function getImprobableOutcomeSignForKoMatch(matchId, officialScore) {
  if (isArenaMode() && hasArenaMatchVoteData()) {
    return getArenaImprobableOutcomeSign(matchId, true);
  }
  return getUniqueOfficialOutcomeBonusSign(collectKnockoutOutcomeVotesForMatch(matchId), officialScore);
}

/** Predicciones confirmadas con marcador completo en un partido. */
function collectCommittedMatchScoreEntries(matchId, isKo) {
  /** @type {Array<{ id: string, pred: { home: unknown, away: unknown } }>} */
  const entries = [];
  for (const part of getParticipantsForDisplay()) {
    const store = loadPredictions(part.id);
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

/** @param {string} matchId @param {{ home: unknown, away: unknown }} officialScore @param {boolean} isKo */
function getClosestScoreBonusIdsForMatch(matchId, officialScore, isKo) {
  if (isArenaMode() && hasArenaMatchVoteData()) {
    return getArenaClosestScoreBonusIds(matchId, isKo);
  }
  return getClosestScoreBonusParticipantIds(officialScore, collectCommittedMatchScoreEntries(matchId, isKo));
}

function $(sel, root = document) {
  return root.querySelector(sel);
}

function quinielaPredsTableWrapClass() {
  return isArenaMode()
    ? "table-scroll quiniela-table-wrap quiniela-table-wrap--scroll-y"
    : "table-scroll quiniela-table-wrap quiniela-table-wrap--full";
}

function participantSearchToolbarHtml({ ariaLabel = "Buscar jugador en la tabla" } = {}) {
  if (!isArenaMode()) return "";
  const sortLabel = participantSortModeLabel();
  return `<div class="participant-search-toolbar participant-search-toolbar--table" data-participant-search-bar>
    <label class="participant-search-toolbar__field">
      <span class="participant-search-toolbar__label">Buscar jugador</span>
      <input
        type="search"
        class="input input-sm participant-search-input"
        placeholder="Nombre o usuario…"
        autocomplete="off"
        enterkeyhint="search"
        aria-label="${escapeHtmlAttr(ariaLabel)}"
      />
    </label>
    <button
      type="button"
      class="btn btn-sm btn-ghost participant-sort-toggle"
      data-participant-sort-toggle
      aria-label="${escapeHtmlAttr(sortLabel)}. Pulsa para cambiar."
      title="${escapeHtmlAttr(sortLabel)}"
    >${escapeHtml(sortLabel)}</button>
  </div>`;
}

/**
 * @param {HTMLElement} toolbar
 * @param {{ total: number, shown: number, withoutSubmission: number }} meta
 * @param {string} q
 */
function updateArenaPredictionHints(toolbar, meta, q) {
  const listHint = ensureArenaHintAfterSearchBar(toolbar);
  const missingHint = ensureArenaMissingHintAfterTable(toolbar);
  if (!q && meta.total > meta.shown) {
    listHint.textContent = `Solo se muestran ${meta.shown} de ${meta.total} predicciones.`;
    listHint.hidden = false;
  } else {
    listHint.textContent = "";
    listHint.hidden = true;
  }
  if (missingHint) {
    if (!q && meta.withoutSubmission > 0) {
      const n = meta.withoutSubmission;
      missingHint.textContent =
        n === 1 ? "1 jugador no mandó predicción." : `${n} jugadores no mandaron predicción.`;
      missingHint.hidden = false;
    } else {
      missingHint.textContent = "";
      missingHint.hidden = true;
    }
  }
}

/** @param {HTMLElement} toolbar */
function findArenaPredictionTableAnchor(toolbar) {
  if (toolbar.closest(".quiniela-preds-head-row")) {
    const body = toolbar.closest(".partidos-acc__body");
    return body?.querySelector(".quiniela-table-wrap") ?? null;
  }
  if (toolbar.closest(".group-preds-table-head")) {
    const host = toolbar.closest(".group-preds-host");
    return host?.querySelector(":scope > .table-scroll") ?? null;
  }
  if (toolbar.closest("#panel-generales")) {
    const host = document.getElementById("generales-preds-host");
    return host?.querySelector(".table-scroll") ?? host;
  }
  return null;
}

/** @param {HTMLElement} toolbar */
function ensureArenaMissingHintAfterTable(toolbar) {
  const anchor = findArenaPredictionTableAnchor(toolbar);
  if (!(anchor instanceof HTMLElement)) return null;
  let next = anchor.nextElementSibling;
  if (next instanceof HTMLElement && next.dataset.arenaMissingHint !== undefined) {
    return next;
  }
  const scope =
    toolbar.closest(".group-preds-host, .partidos-acc__body, #panel-generales") ?? anchor.parentElement;
  scope?.querySelectorAll("[data-arena-missing-hint]").forEach((el) => el.remove());
  const hint = document.createElement("p");
  hint.className = "participant-list-hint participant-list-hint--missing muted";
  hint.dataset.arenaMissingHint = "";
  hint.setAttribute("role", "status");
  hint.hidden = true;
  anchor.insertAdjacentElement("afterend", hint);
  return hint;
}

/**
 * @param {HTMLElement} toolbar
 * @param {{ hasSubmission?: (p: import("./participants.js").Participant) => boolean, getPoints?: (p: import("./participants.js").Participant) => number, currentId?: string | null }} listOpts
 * @param {{ hasSubmission?: (p: import("./participants.js").Participant) => boolean, currentId?: string | null }} [metaOpts]
 */
function stampArenaPredictionListMeta(toolbar, listOpts, metaOpts = listOpts) {
  if (!isArenaMode() || !(toolbar instanceof HTMLElement) || isArenaRankingPanelSearchBar(toolbar)) return;
  const q = getParticipantSearchQuery().trim();
  const meta = getArenaParticipantsListMeta(getParticipantSearchQuery(), metaOpts);
  const displayList = getParticipantsForListDisplay(
    listOpts.currentId ?? null,
    getParticipantSearchQuery(),
    listOpts,
  );
  const listHasSubmission = listOpts.hasSubmission;
  meta.shown = listHasSubmission
    ? displayList.filter((p) => listHasSubmission(p)).length
    : displayList.length;
  toolbar.dataset.arenaPredsShown = String(meta.shown);
  toolbar.dataset.arenaPredsTotal = String(meta.total);
  toolbar.dataset.arenaPredsTruncated = meta.truncated ? "1" : "";
  toolbar.dataset.arenaPredsMissing = String(meta.withoutSubmission);
  updateArenaPredictionHints(toolbar, meta, q);
}

/** Meta de partido: conteo estricto (solo confirmadas); la lista incluye «tú» aunque no hayas confirmado. */
function getQuinielaMatchListMetaOpts(m, session, official, isKo = false) {
  return {
    currentId: session.participantId,
    hasSubmission: (p) => participantHasMatchScoreSubmission(p, m.id, isKo),
  };
}

function syncParticipantSortButtons() {
  if (!isArenaMode()) return;
  const label = participantSortModeLabel();
  document.querySelectorAll("[data-participant-sort-toggle]").forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    btn.textContent = label;
    btn.title = label;
    btn.setAttribute("aria-label", `${label}. Pulsa para cambiar.`);
  });
}

function arenaRankingsHintText() {
  if (!isArenaMode()) return "";
  const data = getArenaServerRankings();
  if (!data?.truncated || data.totalUsers <= data.limit) return "";
  const hasSelfOutsideTop = data.rows?.some((r) => r.self && Number(r.rank) > Number(data.limit));
  const selfNote = hasSelfOutsideTop ? " Se incluye tu posición aunque no estés en el top." : "";
  return `Este ranking muestra el top ${data.limit} de ${data.totalUsers} jugadores.${selfNote} Busca un nombre para filtrar.`;
}

const ARENA_RANKING_PANEL_IDS = ["panel-final-ranking", "panel-match-ranking", "panel-team-order-ranking"];

/** @param {Element} bar */
function isArenaRankingPanelSearchBar(bar) {
  return ARENA_RANKING_PANEL_IDS.some((id) => bar.closest(`#${id}`));
}

/** @param {HTMLElement} bar */
function ensureArenaHintAfterSearchBar(bar) {
  const inRankingPanel = isArenaRankingPanelSearchBar(bar);
  let next = bar.nextElementSibling;
  while (next instanceof HTMLElement) {
    const isList = next.dataset.arenaListHint !== undefined;
    const isRank = next.dataset.arenaRankingHint !== undefined;
    if (inRankingPanel && isList) {
      const rm = next;
      next = next.nextElementSibling;
      rm.remove();
      continue;
    }
    if (!inRankingPanel && isRank) {
      const rm = next;
      next = next.nextElementSibling;
      rm.remove();
      continue;
    }
    if (inRankingPanel && isRank) return next;
    if (!inRankingPanel && isList) return next;
    break;
  }
  const hint = document.createElement("p");
  hint.className = inRankingPanel
    ? "participant-list-hint participant-list-hint--ranking muted"
    : "participant-list-hint muted";
  if (inRankingPanel) hint.dataset.arenaRankingHint = "";
  else hint.dataset.arenaListHint = "";
  hint.setAttribute("role", "status");
  hint.hidden = true;
  bar.insertAdjacentElement("afterend", hint);
  let sib = hint.nextElementSibling;
  const dupKey = inRankingPanel ? "arenaRankingHint" : "arenaListHint";
  while (sib instanceof HTMLElement && sib.dataset[dupKey] !== undefined) {
    const rm = sib;
    sib = sib.nextElementSibling;
    rm.remove();
  }
  return hint;
}

function removeLegacyArenaRankingHints() {
  for (const introId of ["final-ranking-intro", "match-ranking-intro", "team-order-ranking-intro"]) {
    const intro = document.getElementById(introId);
    if (!intro) continue;
    intro.querySelectorAll("[data-arena-ranking-hint]").forEach((el) => el.remove());
    if (intro.tagName === "P") {
      let sib = intro.nextElementSibling;
      while (sib instanceof HTMLElement && sib.dataset.arenaRankingHint !== undefined) {
        const rm = sib;
        sib = sib.nextElementSibling;
        rm.remove();
      }
    }
  }
}

function ensureArenaTruncationHintElements() {
  if (!isArenaMode()) return;
  removeLegacyArenaRankingHints();
  document.querySelectorAll("[data-participant-search-bar]").forEach((bar) => {
    if (!(bar instanceof HTMLElement)) return;
    ensureParticipantSortToggle(bar);
    ensureArenaHintAfterSearchBar(bar);
  });
}

function syncArenaTruncationHints() {
  if (!isArenaMode()) return;
  ensureArenaTruncationHintElements();
  syncParticipantSortButtons();
  const q = getParticipantSearchQuery().trim();
  const rankText = arenaRankingsHintText();
  const activeTab = getActiveTabId();
  document.querySelectorAll("[data-participant-search-bar][data-arena-preds-total]").forEach((bar) => {
    if (!(bar instanceof HTMLElement) || isArenaRankingPanelSearchBar(bar)) return;
    const meta = {
      shown: Number(bar.dataset.arenaPredsShown) || 0,
      total: Number(bar.dataset.arenaPredsTotal) || 0,
      withoutSubmission: Number(bar.dataset.arenaPredsMissing) || 0,
    };
    updateArenaPredictionHints(bar, meta, q);
  });
  document.querySelectorAll("[data-arena-list-hint]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (isArenaRankingPanelSearchBar(el)) {
      el.textContent = "";
      el.hidden = true;
    }
  });
  document.querySelectorAll("[data-arena-ranking-hint]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const panel = el.closest("[data-panel]");
    const panelTab = panel?.getAttribute("data-panel");
    const show = Boolean(rankText) && panelTab === activeTab;
    if (show) {
      el.textContent = rankText;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  });
}

/** @param {string | null | undefined} currentParticipantId */
function mapArenaServerRankingRows(currentParticipantId) {
  const data = getArenaServerRankings();
  if (!data?.rows?.length) return null;
  return data.rows.map((r) => ({
    p: { id: String(r.username), name: String(r.displayName ?? r.username) },
    pts: Number(r.pts) || 0,
    totalBien: Number(r.totalBien) || 0,
    totalExcelente: Number(r.totalExcelente) || 0,
    totalPerfect: Number(r.totalPerfect) || 0,
    totalBonus: Number(r.totalBonus) || 0,
    totalClosest: Number(r.totalClosest) || 0,
    self: Boolean(r.self) || String(r.username) === currentParticipantId,
    displayRank: Number(r.rank) || 0,
    exact: 0,
    outcome: 0,
    zeroPointMatches: 0,
    matchBonusCount: 0,
    countedMatches: 0,
    avgPtsPerMatch: 0,
    matchTopTieCount: 0,
    matchSoleTopCount: 0,
    matchNoPredCount: 0,
  }));
}

function sortRankingRows(rows) {
  return sortByRankingTiebreak(rows);
}

/** @param {string | null | undefined} currentParticipantId */
function getLiveRankingRows(currentParticipantId) {
  const serverRows = isArenaMode() ? mapArenaServerRankingRows(currentParticipantId) : null;
  if (serverRows) return serverRows;
  return sortRankingRows(
    computeLiveParticipantRowsFromData(
      getParticipantsForDisplay(),
      getAllPredictionsMap(),
      loadOfficialResults(),
      currentParticipantId,
      isArenaMode() ? { arenaScoring: true } : {},
    ),
  );
}

/** @param {import("./participants.js").Participant} p @param {string} groupId */
function participantHasGroupOrderSubmission(p, groupId) {
  const pred = loadPredictions(p.id);
  if (pred.groupOrderConfirmed?.[groupId] === true) return true;
  const ord = pred.groupOrder?.[groupId];
  const orderArr =
    Array.isArray(ord) && ord.length >= 4
      ? ord.map((x) => (typeof x === "string" ? x.trim() : ""))
      : [];
  const filled = orderArr.filter(Boolean).length;
  const third = pred.groupThirdAdvances?.[groupId];
  return filled > 0 || third === true || third === false;
}

/** @param {unknown} v */
function matchScoreSideSet(v) {
  if (v === "" || v == null) return false;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n);
}

/** @param {{ home?: unknown, away?: unknown } | null | undefined} pred */
function matchScoreBothFilled(pred) {
  return matchScoreSideSet(pred?.home) && matchScoreSideSet(pred?.away);
}

/**
 * Mayor = más arriba (tras «tú»): confirmada > borrador con marcador > sin predicción.
 * @param {{ home?: unknown, away?: unknown }} pred
 * @param {boolean} predCommitted
 */
function matchPredictionSubmissionRank(pred, predCommitted) {
  if (predCommitted) return 2;
  if (matchScoreBothFilled(pred)) return 1;
  return 0;
}

/**
 * Super-admin: editar predicción no confirmada de otro jugador con el partido ya cerrado.
 * @param {{ participantId: string }} session
 * @param {boolean} predictionsLocked
 * @param {boolean} predCommitted
 */
function isAdminLateMatchPredictionEdit(session, predictionsLocked, predCommitted) {
  return (
    canAdminEditLateMatchPredictions(session.participantId) &&
    predictionsLocked &&
    !predCommitted
  );
}

/**
 * Super-admin: borrar predicción confirmada con el partido en juego o terminado.
 * @param {{ participantId: string }} session
 * @param {boolean} predictionsLocked
 * @param {boolean} predCommitted
 * @param {string} matchStage
 */
function isAdminDeleteMatchPrediction(session, predictionsLocked, predCommitted, matchStage) {
  return (
    canAdminEditLateMatchPredictions(session.participantId) &&
    predictionsLocked &&
    predCommitted &&
    matchStage !== "ready"
  );
}

/**
 * @param {string} participantId
 * @param {string} matchId
 * @param {boolean} isKo
 */
async function clearParticipantMatchPrediction(participantId, matchId, isKo) {
  const latest = loadPredictions(participantId);
  if (isKo) {
    const { [matchId]: _r, ...restConfirmed } = latest.knockoutScoresConfirmed ?? {};
    const next = savePredictions(participantId, {
      knockoutScores: { [matchId]: { home: "", away: "", penaltyWinner: "" } },
      knockoutScoresConfirmed: restConfirmed,
      replaceKnockoutScoresConfirmed: true,
    });
    if (isRemoteSyncActive()) await pushPredictions(participantId, next);
    return;
  }
  const { [matchId]: _r, ...restConfirmed } = latest.groupScoresConfirmed ?? {};
  const next = savePredictions(participantId, {
    groupScores: { [matchId]: { home: "", away: "" } },
    groupScoresConfirmed: restConfirmed,
    replaceGroupScoresConfirmed: true,
  });
  if (isRemoteSyncActive()) await pushPredictions(participantId, next);
}

/**
 * @param {{ participantId: string }} session
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {{ id: string }} m
 * @param {string} targetParticipantId
 * @param {boolean} isKo
 */
function isMatchPredictionSaveBlocked(session, official, m, targetParticipantId, isKo) {
  const locked = isKo ? isKoMatchPredictionsLocked(official, m) : isGroupMatchPredictionsLocked(official, m);
  const pStore = loadPredictions(targetParticipantId);
  const predCommitted = isKo
    ? pStore.knockoutScoresConfirmed?.[m.id] === true
    : pStore.groupScoresConfirmed?.[m.id] === true;
  return isMatchPredictionLockedForActor(
    canAdminEditLateMatchPredictions(session.participantId),
    predCommitted,
    locked,
  );
}

/** @param {import("./participants.js").Participant} p @param {string} matchId @param {boolean} [isKo] */
function participantHasMatchScoreSubmission(p, matchId, isKo = false) {
  const store = loadPredictions(p.id);
  const predCommitted = isKo
    ? store.knockoutScoresConfirmed?.[matchId] === true
    : store.groupScoresConfirmed?.[matchId] === true;
  if (isArenaMode()) return predCommitted;
  const pred = isKo
    ? store.knockoutScores?.[matchId] ?? { home: "", away: "" }
    : store.groupScores?.[matchId] ?? { home: "", away: "" };
  return matchPredictionSubmissionRank(pred, predCommitted) > 0;
}

/** @param {import("./participants.js").Participant} p */
function participantHasGeneralSubmission(p) {
  const pred = loadPredictions(p.id);
  if (pred.generalConfirmed === true) return true;
  const g = pred.general ?? {};
  return Boolean(
    String(g.first ?? "").trim() ||
      String(g.second ?? "").trim() ||
      String(g.third ?? "").trim() ||
      String(g.bestPlayer ?? "").trim() ||
      String(g.bestGk ?? "").trim() ||
      String(g.topScorer ?? "").trim(),
  );
}

/**
 * @param {import("./participants.js").Participant} p
 * @param {{ id: string }} grp
 * @param {ReturnType<typeof getLiveOfficialGroupSnapshot>} liveOfficial
 */
function computeGroupPredTablePoints(p, grp, liveOfficial) {
  const officialOrder = liveOfficial.orderByGroup[grp.id] ?? [];
  const hasOfficialData = liveOfficial.hasOfficialDataByGroup[grp.id] === true;
  if (!hasOfficialData) return 0;
  const voteCountsByPos = getGroupOrderVoteCountsByPosition(grp.id);
  const officialThird = liveOfficial.thirdAdvanceByGroup[grp.id];
  const officialThirdDefined = officialThird === true || officialThird === false;
  const pred = loadPredictions(p.id);
  const ord = pred.groupOrder?.[grp.id];
  const orderArr =
    Array.isArray(ord) && ord.length === 4
      ? ord.map((x) => (typeof x === "string" ? x : ""))
      : ["", "", "", ""];
  const thirdP = pred.groupThirdAdvances?.[grp.id];
  const groupOrderPts = computeGroupOrderPoints(
    orderArr,
    officialOrder,
    thirdP,
    officialThirdDefined ? officialThird : undefined,
  );
  const minorityBonusPts = [0, 1, 2, 3].reduce((acc, i) => {
    const t = orderArr[i];
    const isExact = Boolean(t) && Boolean(officialOrder[i]) && t === officialOrder[i];
    if (isExact && hasUniquePickBonus(voteCountsByPos[i], t)) return acc + 1;
    return acc;
  }, 0);
  return groupOrderPts + minorityBonusPts;
}

/**
 * @param {{ id: string }} grp
 * @param {string | undefined} currentParticipantId
 */
function getGroupPredListOpts(grp, currentParticipantId) {
  const liveOfficial = getLiveOfficialGroupSnapshot();
  const scoringActive = liveOfficial.hasOfficialDataByGroup[grp.id] === true;
  return {
    currentId: currentParticipantId ?? null,
    hasSubmission: (p) => participantHasGroupOrderSubmission(p, grp.id),
    scoringActive,
    previewSeed: `group:${grp.id}`,
    getPoints: (p) => computeGroupPredTablePoints(p, grp, liveOfficial),
  };
}

/**
 * @param {{ id: string, roundId?: string }} m
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {boolean} [isKo]
 */
function isQuinielaMatchScoringActive(m, official, isKo = false) {
  const off = isKo
    ? official.knockoutScores?.[m.id] ?? { home: "", away: "" }
    : official.groupScores[m.id] ?? { home: "", away: "" };
  if (isKo) {
    const koStage = official.knockoutMatchState?.[m.id] ?? "ready";
    const officialConfirmed = official.knockoutScoresConfirmed?.[m.id] === true;
    const bothFilled = off.home !== "" && off.away !== "";
    return bothFilled && (koStage === "started" || officialConfirmed);
  }
  const matchStage = official.groupMatchState?.[m.id] ?? "ready";
  const officialConfirmed = matchStage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
  const bothFilled = off.home !== "" && off.away !== "";
  return bothFilled && (matchStage === "started" || officialConfirmed);
}

/**
 * @param {import("./participants.js").Participant} p
 * @param {{ id: string, roundId?: string }} m
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {boolean} isKo
 */
function computeQuinielaMatchListPoints(p, m, official, isKo) {
  const pStore = loadPredictions(p.id);
  const predCommitted = isKo
    ? pStore.knockoutScoresConfirmed?.[m.id] === true
    : pStore.groupScoresConfirmed?.[m.id] === true;
  if (!predCommitted) return 0;
  const pred = isKo
    ? pStore.knockoutScores?.[m.id] ?? { home: "", away: "" }
    : pStore.groupScores?.[m.id] ?? { home: "", away: "" };
  const off = isKo
    ? official.knockoutScores?.[m.id] ?? { home: "", away: "" }
    : official.groupScores[m.id] ?? { home: "", away: "" };
  if (!isQuinielaMatchScoringActive(m, official, isKo)) return 0;
  const matchScoring = getMatchScoringForQuiniela(m);
  const improbableSign = isKo
    ? getImprobableOutcomeSignForKoMatch(m.id, off)
    : getImprobableOutcomeSignForMatch(m.id, off);
  const koPenaltyPhase = isKo ? knockoutRoundRequiresPenaltyPickOnDraw(m.roundId) : false;
  const closestEligible = getClosestScoreBonusIdsForMatch(m.id, off, isKo).has(p.id);
  return (
    computeGroupMatchPoints(off, pred, improbableSign, matchScoring, koPenaltyPhase, closestEligible) ?? 0
  );
}

/**
 * @param {{ id: string, roundId?: string }} m
 * @param {{ participantId: string }} session
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {boolean} [isKo]
 */
function getQuinielaMatchListOpts(m, session, official, isKo = false) {
  const currentId = session.participantId;
  return {
    currentId,
    hasSubmission: (p) =>
      p.id === currentId || participantHasMatchScoreSubmission(p, m.id, isKo),
    scoringActive: isQuinielaMatchScoringActive(m, official, isKo),
    previewSeed: `match:${m.id}`,
    getPoints: (p) => computeQuinielaMatchListPoints(p, m, official, isKo),
  };
}

/**
 * @param {ParentNode | null | undefined} card
 * @param {{ id: string, roundId?: string }} m
 * @param {{ participantId: string }} session
 * @param {ReturnType<typeof loadOfficialResults>} official
 * @param {boolean} [isKo]
 */
function stampQuinielaCardPredictionMeta(card, m, session, official, isKo = false) {
  const bar = card?.querySelector?.("[data-participant-search-bar]");
  if (!(bar instanceof HTMLElement)) return;
  stampArenaPredictionListMeta(
    bar,
    getQuinielaMatchListOpts(m, session, official, isKo),
    getQuinielaMatchListMetaOpts(m, session, official, isKo),
  );
}

/**
 * @param {ParentNode | null | undefined} wrap
 * @param {{ participantId: string }} session
 * @param {ReturnType<typeof loadOfficialResults>} official
 */
function stampAllQuinielaPredictionMetas(wrap, session, official) {
  if (!isArenaMode() || !wrap || !session) return;
  wrap.querySelectorAll("article.quiniela-match[data-quiniela-mid]").forEach((card) => {
    const mid = card.getAttribute("data-quiniela-mid");
    if (!mid) return;
    const gm = GROUP_MATCHES.find((x) => x.id === mid);
    if (gm) {
      stampQuinielaCardPredictionMeta(card, gm, session, official, false);
      return;
    }
    const mKo = getKnockoutMatchesFlat().find((x) => x.id === mid);
    if (mKo) stampQuinielaCardPredictionMeta(card, mKo, session, official, true);
  });
}

/**
 * @template {{ p: { id: string, name: string }, pred: { home?: unknown, away?: unknown }, predCommitted: boolean }} T
 * @param {T[]} rows
 * @param {string} sessionParticipantId
 */
function sortQuinielaPredictionRows(rows, sessionParticipantId) {
  const sortMode = isArenaMode() ? getParticipantSortMode() : "default";
  const byName = (/** @type {{ p: { name: string } }} */ a, /** @type {{ p: { name: string } }} */ b) =>
    a.p.name.localeCompare(b.p.name, "es", { sensitivity: "base" });
  return [...rows].sort((a, b) => {
    const aSelf = a.p.id === sessionParticipantId;
    const bSelf = b.p.id === sessionParticipantId;
    if (aSelf !== bSelf) return aSelf ? -1 : 1;
    if (sortMode === "points-desc") {
      const apt = a.pts ?? -1;
      const bpt = b.pts ?? -1;
      if (apt !== bpt) return bpt - apt;
      return byName(a, b);
    }
    if (sortMode === "points-asc") {
      const apt = a.pts ?? Number.MAX_SAFE_INTEGER;
      const bpt = b.pts ?? Number.MAX_SAFE_INTEGER;
      if (apt !== bpt) return apt - bpt;
      return byName(a, b);
    }
    if (isArenaMode()) return byName(a, b);
    const ar = matchPredictionSubmissionRank(a.pred, a.predCommitted);
    const br = matchPredictionSubmissionRank(b.pred, b.predCommitted);
    if (ar !== br) return br - ar;
    return byName(a, b);
  });
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

  const groupListOpts = getGroupPredListOpts(grp, currentParticipantId);
  const groupParticipantRowData = getParticipantsForListDisplay(
    currentParticipantId,
    getParticipantSearchQuery(),
    groupListOpts,
  ).map((p) => {
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
          } else if (hasOfficialData && hitExact && i >= 2) {
            ptsCell += 1;
            badgeTitle = "Posición exacta acertada (+1)";
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
      /** Solo puntos del bloque «orden del grupo» (máx. 9); la quiniela por partido se ve en su pestaña. */
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
      const hasSubmission = participantHasGroupOrderSubmission(p, grp.id);
      const rowClasses = [
        "group-preds-row",
        p.id === currentParticipantId ? "row-self" : "",
        hasSubmission ? "" : "group-preds-row--empty-pred",
      ]
        .filter(Boolean)
        .join(" ");
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
    <div class="group-preds-table-head">
      <h2 class="subsection-title group-preds-table-title">Predicciones de todos</h2>
      ${participantSearchToolbarHtml({ ariaLabel: `Buscar jugador en el grupo ${grp.id}` })}
    </div>
    <div class="table-scroll table-scroll--group-preds table-scroll--preds-body">
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
    </div>
    ${buildGroupVoteStatsHtml(grp.id)}`;
}

/** @param {ParentNode | null | undefined} host @param {{ id: string }} grp @param {string | undefined} currentParticipantId */
function stampGroupPredListMeta(host, grp, currentParticipantId) {
  const bar = host?.querySelector?.("[data-participant-search-bar]");
  if (!(bar instanceof HTMLElement)) return;
  stampArenaPredictionListMeta(bar, getGroupPredListOpts(grp, currentParticipantId));
}

function clampGoalInput(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return "";
  return Math.max(0, Math.min(20, n));
}

/**
 * @param {HTMLInputElement} inp
 * @param {number} delta
 */
function applyScoreStepperDelta(inp, delta) {
  const isEmpty = inp.value === "";
  let n = isEmpty ? 0 : parseInt(inp.value, 10) || 0;

  if (delta < 0) {
    if (isEmpty) return;
    if (n === 0) {
      inp.value = "";
      return;
    }
  }

  n = Math.max(0, Math.min(20, n + delta));
  inp.value = String(n);
}

/**
 * En móvil solo +/− (sin teclado). En escritorio el centro sigue siendo editable.
 * @param {HTMLElement} stepper
 * @param {HTMLInputElement} inp
 */
function wireScoreStepperMobileBehavior(stepper, inp) {
  if (!(stepper instanceof HTMLElement) || !(inp instanceof HTMLInputElement) || inp.disabled) return;
  if (stepper.dataset.pm26MobileStepperWired === "1") return;
  stepper.dataset.pm26MobileStepperWired = "1";

  stepper.querySelectorAll(".score-stepper__btn").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
    });
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
  });

  if (isMobileLayout()) {
    stepper.classList.add("score-stepper--buttons-only");
    inp.readOnly = true;
    inp.tabIndex = -1;
    inp.type = "text";
    inp.setAttribute("inputmode", "none");
    inp.setAttribute("autocomplete", "off");
    inp.setAttribute("aria-readonly", "true");
    const blockInputFocus = (e) => {
      e.preventDefault();
      if (document.activeElement === inp) inp.blur();
    };
    inp.addEventListener("mousedown", blockInputFocus);
    inp.addEventListener("touchstart", blockInputFocus, { passive: false });
    inp.addEventListener("focus", () => inp.blur());
    return;
  }

  inp.readOnly = true;
  inp.setAttribute("inputmode", "numeric");
  inp.setAttribute("pattern", "[0-9]*");
  inp.addEventListener("focus", () => {
    inp.readOnly = false;
    inp.select?.();
  });
  inp.addEventListener("blur", () => {
    inp.readOnly = true;
  });
}

/**
 * @param {HTMLElement} stepper
 * @param {HTMLInputElement} inp
 * @param {(triggerEl: HTMLElement) => void} collect
 */
function wireScoreStepperButtons(stepper, inp, collect) {
  stepper.querySelectorAll(".score-stepper__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const d = parseInt(btn.dataset.delta ?? "0", 10);
      applyScoreStepperDelta(inp, d);
      btn.blur();
      if (document.activeElement === inp) inp.blur();
      collect(btn);
    });
  });
}

/** Quita foco del stepper antes de reemplazar filas (evita salto de scroll en móvil). */
function blurPartidosInteractionFocus(focusEl) {
  if (focusEl instanceof HTMLElement) {
    focusEl.blur();
    return;
  }
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    (active.matches(".score-stepper__btn, .score-stepper__input") ||
      active.closest(".quiniela-preds, .quiniela-official, .partidos-ko-official"))
  ) {
    active.blur();
  }
}

/** @param {typeof GROUP_MATCHES[number] | ReturnType<typeof getKnockoutMatchesFlat>[number]} m @param {ReturnType<typeof loadOfficialResults>} official @param {boolean} isKo */
function isPartidosDraftScoreEditPhase(m, official, isKo) {
  if (isKo) {
    return (official.knockoutMatchState?.[m.id] ?? "ready") === "ready";
  }
  return (official.groupMatchState?.[m.id] ?? "ready") === "ready" && !isGroupMatchPredictionsLocked(official, m);
}

/**
 * En móvil, actualiza solo la fila del jugador (sin reemplazar tbody → sin parpadeo de scroll).
 * @param {HTMLElement | null} wrap
 * @param {string} matchId
 * @param {boolean} isKo
 * @param {HTMLElement | null | undefined} focusEl
 * @returns {boolean}
 */
function tryLightPartidosSelfPredPatch(wrap, matchId, isKo, focusEl) {
  if (!isMobileLayout() || !wrap) return false;
  const session = loadSession();
  if (!session) return false;

  const m = isKo
    ? getKnockoutMatchesFlat().find((x) => x.id === matchId)
    : GROUP_MATCHES.find((x) => x.id === matchId);
  if (!m) return false;

  const official = loadOfficialResults();
  if (!isPartidosDraftScoreEditPhase(m, official, isKo)) return false;

  const card = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(matchId)}"]`);
  if (!card) return false;

  if (focusEl instanceof HTMLElement) {
    const focusRow = focusEl.closest("tr.quiniela-pred-edit-row, tr.partidos-ko-pred-edit-row");
    const focusPid = focusRow?.dataset.predPid;
    if (focusPid && focusPid !== session.participantId) return false;
  }

  const rowSel = isKo
    ? `tr.partidos-ko-pred-edit-row[data-pred-pid="${CSS.escape(session.participantId)}"]`
    : `tr.quiniela-pred-edit-row[data-pred-pid="${CSS.escape(session.participantId)}"]`;
  const row = card.querySelector(rowSel);
  if (!row) return false;

  const preds = loadPredictions(session.participantId);
  const pred = isKo
    ? (preds.knockoutScores?.[matchId] ?? { home: "", away: "" })
    : (preds.groupScores[matchId] ?? { home: "", away: "" });

  const ganadorTd = row.querySelector("td.quiniela-ganador-col");
  if (ganadorTd) {
    let ganadorInner;
    if (isKo) {
      const { ri, mi } = getKoRoundMatchIndex(m.id);
      const pScores = preds.knockoutScores ?? {};
      const vm = {
        home: resolveKnockoutSlotLabel(ri, mi, "home", pScores),
        away: resolveKnockoutSlotLabel(ri, mi, "away", pScores),
      };
      const koPenaltyPhase = knockoutRoundRequiresPenaltyPickOnDraw(m.roundId);
      const showPenControls = koPenaltyPhase && predictionOutcomeSign(pred) === "d";
      ganadorInner = quinielaKoGanadorCellHtml(vm, pred, m.roundId, {
        selfEditing: showPenControls,
        matchId: showPenControls ? m.id : "",
        targetParticipantId: showPenControls ? session.participantId : "",
      });
    } else {
      ganadorInner = quinielaGanadorPickLabel(m, pred);
    }
    ganadorTd.innerHTML = `<div class="quiniela-cell-badges-wrap quiniela-cell-badges-wrap--ganador"><div class="quiniela-cell-badges-main"><span class="quiniela-ganador-pick">${ganadorInner}</span></div></div>`;
  }

  const confirmBtn = row.querySelector(".quiniela-pred-confirm-user, .partidos-ko-pred-confirm-user");
  if (confirmBtn instanceof HTMLButtonElement) {
    if (isKo) {
      const koPenaltyPhase = knockoutRoundRequiresPenaltyPickOnDraw(m.roundId);
      const scoresOk = pred.home !== "" && pred.away !== "";
      const drawPred = predictionOutcomeSign(pred) === "d";
      const penOk =
        !koPenaltyPhase || !drawPred || pred.penaltyWinner === "home" || pred.penaltyWinner === "away";
      confirmBtn.disabled = !(scoresOk && penOk);
    } else {
      confirmBtn.disabled = pred.home === "" || pred.away === "";
    }
  }

  if (isKo && row.querySelector(".ko-user-pen-pick")) {
    wireQuinielaPredictionHandlersInScope(row);
  }

  return true;
}

/**
 * @param {HTMLElement} tb
 * @param {string} html
 * @param {number | null} scrollY
 */
function replacePartidosPredTbody(tb, html, scrollY) {
  if (scrollY == null) {
    tb.innerHTML = html;
    return;
  }
  const prevAnchor = tb.style.overflowAnchor;
  tb.style.overflowAnchor = "none";
  tb.innerHTML = html;
  window.scrollTo(0, scrollY);
  tb.style.overflowAnchor = prevAnchor;
}

/**
 * @param {HTMLElement | null} wrap
 * @param {string} matchId
 * @param {HTMLElement | null | undefined} focusEl
 */
function restorePartidosPredRowsInteraction(wrap, matchId, focusEl) {
  if (!wrap || isMobileLayout()) return;
  const anchor =
    capturePartidosInteractionAnchorFromElement(focusEl, wrap) ?? capturePartidosInteractionAnchor(wrap);
  const viewportLock =
    anchor?.articleMid === matchId
      ? (() => {
          const ae = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(matchId)}"]`);
          return ae ? { mid: matchId, vTop: ae.getBoundingClientRect().top } : null;
        })()
      : null;
  if (anchor?.articleMid === matchId) restorePartidosInteractionAnchor(wrap, anchor, viewportLock);
}

/** @param {ParentNode} [root] */
function syncQuinielaTableHorizontalScroll(root = document) {
  const scope = root instanceof HTMLElement || root instanceof Document ? root : document;
  scope.querySelectorAll(".quiniela-table-wrap.table-scroll").forEach((wrap) => {
    if (!(wrap instanceof HTMLElement)) return;
    const needsScroll = wrap.scrollWidth > wrap.clientWidth + 1;
    wrap.classList.toggle("quiniela-table-wrap--needs-scroll-x", needsScroll);
  });
}

/** @param {ParentNode} [root] */
function scheduleSyncQuinielaTableHorizontalScroll(root = document) {
  requestAnimationFrame(() => syncQuinielaTableHorizontalScroll(root));
}

/**
 * @param {string} matchId
 * @param {"home"|"away"} side
 * @param {string|number|""} value
 * @param {{ disabled?: boolean, extraClass?: string, idAttr?: "data-mid"|"data-kid"|"data-okid"|"data-ogid" }} [opts]
 */
function scoreStepperHtml(matchId, side, value, opts = {}) {
  const { disabled = false, extraClass = "", idAttr = "data-mid" } = opts;
  const v = value === "" || value === undefined ? "" : String(clampGoalInput(value));
  const dis = disabled ? "disabled" : "";
  const readOnly = disabled ? "" : "readonly";
  const idKey =
    idAttr === "data-kid"
      ? "data-kid"
      : idAttr === "data-okid"
        ? "data-okid"
        : idAttr === "data-ogid"
          ? "data-ogid"
          : "data-mid";
  return `<div class="score-stepper ${extraClass}">
    <button type="button" class="score-stepper__btn" ${idKey}="${escapeHtml(matchId)}" data-side="${side}" data-delta="-1" ${dis} aria-label="Un gol menos">−</button>
    <input type="number" min="0" max="20" class="score-stepper__input input input-score" ${idKey}="${escapeHtml(matchId)}" data-side="${side}" value="${escapeHtml(v)}" ${dis} ${readOnly} inputmode="numeric" pattern="[0-9]*" step="1" />
    <button type="button" class="score-stepper__btn" ${idKey}="${escapeHtml(matchId)}" data-side="${side}" data-delta="1" ${dis} aria-label="Un gol más">+</button>
  </div>`;
}

/**
 * @param {HTMLElement} wrap
 * @param {"knockout"|"grupos"} mode
 * @param {(scores: Record<string, { home: string|number|"", away: string|number|"" }>, triggerEl?: HTMLElement | null) => void} onCommit
 * @param {{ collectOnInput?: boolean }} [wireOpts] si true, también en `input` (marcador oficial en vivo al teclear)
 */
function wireScoreSteppers(wrap, mode, onCommit, wireOpts = {}) {
  const { collectOnInput = false } = wireOpts;
  const isKo = mode === "knockout";
  const inputSel = isKo ? ".score-stepper__input[data-kid]" : ".score-stepper__input[data-mid]";

  /** @param {HTMLElement | null | undefined} triggerEl */
  function collect(triggerEl) {
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
    onCommit(next, triggerEl instanceof HTMLElement ? triggerEl : null);
  }

  wrap.querySelectorAll(".score-stepper").forEach((stepper) => {
    const inp = stepper.querySelector(inputSel);
    if (!inp || inp.disabled) return;
    wireScoreStepperMobileBehavior(stepper, inp);
    wireScoreStepperButtons(stepper, inp, (triggerEl) => collect(triggerEl));
    inp.addEventListener("change", () => {
      if (isMobileLayout()) return;
      const n = clampGoalInput(inp.value);
      inp.value = n === "" ? "" : String(n);
      collect(inp);
    });
    if (collectOnInput) {
      inp.addEventListener("input", () => {
        if (isMobileLayout()) return;
        collect(inp);
      });
    }
  });
}

/**
 * @param {HTMLElement} wrap
 * @param {(scores: Record<string, { home: string|number|"", away: string|number|"" }>) => void} onCommit
 */
function wireOfficialKnockoutSteppers(wrap, onCommit) {
  const inputSel = ".score-stepper__input[data-okid]";
  /** @param {HTMLElement | null | undefined} triggerEl */
  function collect(triggerEl) {
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
    onCommit(next, triggerEl instanceof HTMLElement ? triggerEl : null);
  }
  wrap.querySelectorAll(".score-stepper").forEach((stepper) => {
    if (stepper.dataset.pm26StepperWired === "1") return;
    stepper.dataset.pm26StepperWired = "1";
    const inp = stepper.querySelector(inputSel);
    if (!inp || inp.disabled) return;
    wireScoreStepperMobileBehavior(stepper, inp);
    wireScoreStepperButtons(stepper, inp, (triggerEl) => collect(triggerEl));
    inp.addEventListener("change", () => {
      if (isMobileLayout()) return;
      const n = clampGoalInput(inp.value);
      inp.value = n === "" ? "" : String(n);
      collect(inp);
    });
  });
}

/**
 * Stepper del marcador oficial en fase de grupos (`data-ogid`, distinto de predicciones `data-mid`).
 * @param {HTMLElement} wrap
 * @param {(scores: Record<string, { home: string|number|"", away: string|number|"" }>, triggerEl?: HTMLElement | null) => void} onCommit
 * @param {{ collectOnInput?: boolean }} [wireOpts]
 */
function wireOfficialGroupSteppers(wrap, onCommit, wireOpts = {}) {
  const { collectOnInput = false } = wireOpts;
  const inputSel = ".score-stepper__input[data-ogid]";

  /** @param {HTMLElement | null | undefined} triggerEl */
  function collect(triggerEl) {
    /** @type {Record<string, { home: string|number|"", away: string|number|"" }>} */
    const next = {};
    wrap.querySelectorAll(inputSel).forEach((el) => {
      const id = el.dataset.ogid;
      const side = el.dataset.side;
      if (!id || (side !== "home" && side !== "away")) return;
      if (!next[id]) next[id] = { home: "", away: "" };
      const raw =
        el.value === "" ? "" : Math.max(0, Math.min(20, parseInt(el.value, 10) || 0));
      next[id][side] = raw;
    });
    onCommit(next, triggerEl instanceof HTMLElement ? triggerEl : null);
  }

  wrap.querySelectorAll(".score-stepper").forEach((stepper) => {
    if (stepper.dataset.pm26StepperWired === "1") return;
    stepper.dataset.pm26StepperWired = "1";
    const inp = stepper.querySelector(inputSel);
    if (!inp || inp.disabled) return;
    wireScoreStepperMobileBehavior(stepper, inp);
    wireScoreStepperButtons(stepper, inp, (triggerEl) => collect(triggerEl));
    inp.addEventListener("change", () => {
      if (isMobileLayout()) return;
      const n = clampGoalInput(inp.value);
      inp.value = n === "" ? "" : String(n);
      collect(inp);
    });
    if (collectOnInput) {
      let inputTimer = null;
      inp.addEventListener("input", () => {
        if (isMobileLayout()) return;
        if (inputTimer != null) clearTimeout(inputTimer);
        inputTimer = window.setTimeout(() => {
          inputTimer = null;
          collect(inp);
        }, 80);
      });
    }
  });
}

/** Canvas de pastillas: fuera del camino crítico del clic (solo la tarjeta afectada). */
function deferPartidosCardCanvasSync(card) {
  if (!(card instanceof HTMLElement)) return;
  requestAnimationFrame(() => {
    syncQuinielaPerfectBonusCanvases(card);
    syncGroupPtsBadgeCanvases(card);
  });
}

/** Tbody vacío: las filas se generan al abrir el acordeón (mejora INP al cargar Partidos). */
function partidosPredsLazyTbodyHtml() {
  return `<tbody data-pm26-preds-lazy="1"></tbody>`;
}

/**
 * @param {HTMLElement} card
 * @param {{ participantId: string }} session
 */
function hydratePartidosMatchPredsTable(card, session) {
  if (!(card instanceof HTMLElement) || !session) return;
  const tb = card.querySelector(".quiniela-preds tbody");
  if (!(tb instanceof HTMLElement) || tb.dataset.pm26PredsLazy !== "1") return;
  const mid = card.dataset.quinielaMid;
  if (!mid) return;

  const official = loadOfficialResults();
  const isAdmin = canEditOfficialResults(session.participantId);
  const gm = GROUP_MATCHES.find((x) => x.id === mid);
  if (gm) {
    tb.innerHTML = buildQuinielaPredRowsHtml(gm, session, official, isAdmin);
    delete tb.dataset.pm26PredsLazy;
    stampQuinielaCardPredictionMeta(card, gm, session, official, false);
    wireQuinielaPredictionHandlersInScope(card, session);
    deferPartidosCardCanvasSync(card);
    scheduleSyncQuinielaTableHorizontalScroll(card);
    return;
  }
  const mKo = getKnockoutMatchesFlat().find((x) => x.id === mid);
  if (!mKo) return;
  tb.innerHTML = buildQuinielaPredRowsHtmlKo(mKo, session, official, isAdmin);
  delete tb.dataset.pm26PredsLazy;
  stampQuinielaCardPredictionMeta(card, mKo, session, official, true);
  wireQuinielaPredictionHandlersInScope(card, session);
  deferPartidosCardCanvasSync(card);
  scheduleSyncQuinielaTableHorizontalScroll(card);
}

/**
 * @param {HTMLElement} card
 * @param {{ participantId: string } | null} session
 */
function scheduleHydratePartidosMatchPredsTable(card, session) {
  if (!(card instanceof HTMLElement) || !session) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => hydratePartidosMatchPredsTable(card, session));
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
  const displayLabel = normalizeTeamName(label);
  if (BRACKET_KNOWN_TEAMS.has(displayLabel)) {
    return `<div class="bracket-team-line${winCls}">${teamLabelHtml(displayLabel)}</div>`;
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
      const chatHost = document.getElementById("arena-chat");
      const chatVisible = chatHost && !chatHost.hidden;
      if (chatVisible) {
        document.getElementById("arena-chat-input")?.focus();
      } else {
        drawer.querySelector(".tab")?.focus();
      }
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

/** @returns {string} */
function getActiveTabId() {
  const saved = localStorage.getItem(TAB_KEY);
  if (saved && document.querySelector(`.tab[data-tab="${CSS.escape(saved)}"]`)) return saved;
  return "grupos";
}

/** @param {string} panelId */
function markPanelContentReady(panelId) {
  const panel = document.querySelector(`.panel[data-panel="${CSS.escape(panelId)}"]`);
  if (panel instanceof HTMLElement) panel.dataset.pm26ContentReady = "1";
}

/** @param {string} panelId */
function isPanelContentReady(panelId) {
  return document.querySelector(`.panel[data-panel="${CSS.escape(panelId)}"]`)?.dataset.pm26ContentReady === "1";
}

function invalidateAllPanelContent() {
  document.querySelectorAll(".panel[data-panel]").forEach((p) => {
    delete p.dataset.pm26ContentReady;
  });
}

/** @returns {HTMLElement | null} */
function getActivePanelElement() {
  return document.querySelector(`.panel[data-panel="${CSS.escape(getActiveTabId())}"]`);
}

/** @returns {{ x: number, y: number }} */
function captureWindowScrollAnchor() {
  return { x: window.scrollX, y: window.scrollY };
}

/** @param {{ x: number, y: number } | null | undefined} anchor */
function restoreWindowScrollAnchor(anchor) {
  if (!anchor) return;
  const apply = () => {
    const y = window.scrollY;
    /* Tras innerHTML el scroll suele saltar arriba: recuperar. Si el usuario ya se movió, no forzar. */
    if (y < 16 && anchor.y > 32) {
      window.scrollTo(anchor.x, anchor.y);
      return;
    }
    if (Math.abs(y - anchor.y) < 24) return;
  };
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
}

/**
 * @param {(tabId: string) => void} [onTabChange]
 */
function initTabs(onTabChange) {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  let activeTabId = /** @type {string | null} */ (null);

  /**
   * @param {string} id
   * @param {{ notifyChange?: boolean }} [opts]
   */
  function setTab(id, opts = {}) {
    const { notifyChange = true } = opts;
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
    if (notifyChange) onTabChange?.(id);
    if (switched) scrollAppMainToTop();
  }

  tabs.forEach((t) => {
    t.addEventListener("click", () => setTab(t.dataset.tab));
  });

  const saved = localStorage.getItem(TAB_KEY);
  let initial = saved && $(`.tab[data-tab="${saved}"]`) ? saved : "grupos";
  if (initial === "quiniela") initial = "partidos";
  setTab(initial, { notifyChange: false });
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
    const predictionsLocked = isGroupMatchPredictionsLocked(official, m);
    const predCommitted = pStore.groupScoresConfirmed?.[m.id] === true;
    if (!predictionsLocked && !predCommitted) return false;
  }
  const labelScoresKo = allFilledOfficialKnockoutScores(official);
  for (const m of getKnockoutMatchesFlat()) {
    const predictionsLocked = isKoMatchPredictionsLocked(official, m);
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
  if (isArenaMode()) {
    wrap.classList.add("sync-live-badge--on");
    wrap.classList.remove("sync-live-badge--off");
    textEl.textContent = "Arena · en línea";
    wrap.title = "Tus predicciones se guardan en el servidor. Rankings y resultados oficiales se actualizan periódicamente.";
    return;
  }
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

let participantSearchReady = false;
let participantSearchDebounceId = 0;

const ARENA_SEARCH_REFRESH_MS = 480;
const ARENA_REMOTE_SEARCH_MIN_LEN = 2;

function captureParticipantSearchFocus() {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || !active.classList.contains("participant-search-input")) {
    return null;
  }
  const card = active.closest("article.quiniela-match");
  const predsHost = active.closest(".group-preds-host");
  return {
    matchId: card?.getAttribute("data-quiniela-mid") ?? null,
    groupId: predsHost?.dataset?.groupId ?? null,
    panelId: active.closest("[data-panel]")?.id ?? null,
    caret: active.selectionStart ?? 0,
  };
}

/** @param {ReturnType<typeof captureParticipantSearchFocus>} snap */
function restoreParticipantSearchFocus(snap) {
  if (!snap) return;
  let input = null;
  if (snap.matchId) {
    const card = document.querySelector(
      `article.quiniela-match[data-quiniela-mid="${CSS.escape(snap.matchId)}"]`,
    );
    const det = card?.querySelector("details.partidos-acc");
    if (det instanceof HTMLDetailsElement) det.open = true;
    if (card instanceof HTMLElement) {
      const sess = loadSession();
      if (sess) hydratePartidosMatchPredsTable(card, sess);
    }
    input = card?.querySelector(".participant-search-input");
  } else if (snap.groupId) {
    const host = document.querySelector(`.group-preds-host[data-group-id="${CSS.escape(snap.groupId)}"]`);
    input = host?.querySelector(".participant-search-input");
  } else if (snap.panelId) {
    input = document.querySelector(`#${CSS.escape(snap.panelId)} .participant-search-input`);
  }
  if (!(input instanceof HTMLInputElement)) return;
  input.focus({ preventScroll: true });
  const pos = Math.min(snap.caret ?? input.value.length, input.value.length);
  try {
    input.setSelectionRange(pos, pos);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ participantId: string }} session
 */
function refreshArenaPartidosPredictionTables(session) {
  const wrap = $("#quiniela-wrap");
  if (!wrap || !session) return;
  const official = loadOfficialResults();
  const isAdmin = canEditOfficialResults(session.participantId);
  wrap.querySelectorAll("article.quiniela-match[data-quiniela-mid]").forEach((card) => {
    const mid = card.getAttribute("data-quiniela-mid");
    if (!mid) return;
    const tb = card.querySelector(".quiniela-preds tbody");
    if (!tb || tb.dataset.pm26PredsLazy === "1") return;
    const gm = GROUP_MATCHES.find((x) => x.id === mid);
    if (gm) {
      tb.innerHTML = buildQuinielaPredRowsHtml(gm, session, official, isAdmin);
      stampQuinielaCardPredictionMeta(card, gm, session, official, false);
      wireQuinielaPredictionHandlersInScope(card, session);
      return;
    }
    const mKo = getKnockoutMatchesFlat().find((x) => x.id === mid);
    if (mKo) {
      tb.innerHTML = buildQuinielaPredRowsHtmlKo(mKo, session, official, isAdmin);
      stampQuinielaCardPredictionMeta(card, mKo, session, official, true);
      wireQuinielaPredictionHandlersInScope(card, session);
    }
  });
  syncQuinielaPerfectBonusCanvases(wrap);
  syncGroupPtsBadgeCanvases(wrap);
  syncArenaTruncationHints();
  scheduleSyncQuinielaTableHorizontalScroll(wrap);
}

/**
 * @param {{ participantId: string }} session
 */
function refreshArenaGruposPredictionTables(session) {
  const wrap = $("#grupos-wrap");
  if (!wrap || !session) return;
  wrap.querySelectorAll(".group-preds-host[data-group-id]").forEach((host) => {
    const groupId = host.dataset.groupId;
    const grp = GROUPS.find((g) => g.id === groupId);
    if (!grp) return;
    host.innerHTML = buildGroupPredictionsTableHtml(grp, session.participantId);
    stampGroupPredListMeta(host, grp, session.participantId);
  });
  syncGroupPtsBadgeCanvases(wrap);
  syncArenaTruncationHints();
}

/**
 * @param {{ participantId: string }} session
 */
function refreshArenaPredictionTablesForActiveTab(session) {
  const focusSnap = captureParticipantSearchFocus();
  const tab = getActiveTabId();
  if (tab === "partidos") {
    refreshArenaPartidosPredictionTables(session);
  } else if (tab === "generales") {
    renderGeneralesComparisonTable(session.participantId);
    syncArenaTruncationHints();
  } else if (tab === "grupos") {
    refreshArenaGruposPredictionTables(session);
  } else {
    refreshAll(session, { preserveScroll: true, onlyActivePanel: true });
    requestAnimationFrame(() => restoreParticipantSearchFocus(focusSnap));
    return;
  }
  requestAnimationFrame(() => restoreParticipantSearchFocus(focusSnap));
}

function syncParticipantSearchInputs(value = getParticipantSearchQuery()) {
  document.querySelectorAll(".participant-search-input").forEach((el) => {
    if (el instanceof HTMLInputElement && el.value !== value) el.value = value;
  });
}

function ensureParticipantSortToggle(bar) {
  if (!(bar instanceof HTMLElement) || !isArenaMode()) return;
  if (isArenaRankingPanelSearchBar(bar)) return;
  if (bar.querySelector("[data-participant-sort-toggle]")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-sm btn-ghost participant-sort-toggle";
  btn.dataset.participantSortToggle = "";
  const label = participantSortModeLabel();
  btn.textContent = label;
  btn.title = label;
  btn.setAttribute("aria-label", `${label}. Pulsa para cambiar.`);
  bar.appendChild(btn);
}

function initParticipantSearch(onSearchChange) {
  if (!isArenaMode()) return;
  if (participantSearchReady) return;
  participantSearchReady = true;
  syncParticipantSearchInputs();
  document.querySelectorAll("[data-participant-search-bar]").forEach((bar) => {
    if (bar instanceof HTMLElement) ensureParticipantSortToggle(bar);
  });
  syncParticipantSortButtons();

  const runSearchRefresh = (/** @type {string} */ value) => {
    setParticipantSearchQuery(value);
    syncParticipantSearchInputs(value);
    const q = String(value ?? "").trim();
    const focusSnap = captureParticipantSearchFocus();
    const finish = () => {
      onSearchChange();
      requestAnimationFrame(() => restoreParticipantSearchFocus(focusSnap));
    };
    if (q.length >= ARENA_REMOTE_SEARCH_MIN_LEN) {
      void arenaSearchPredictions(q)
        .then((res) => {
          if (res?.predictions) mergePredictionsFromRemote(res.predictions);
          finish();
        })
        .catch(finish);
      return;
    }
    finish();
  };

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("participant-search-input")) return;
    setParticipantSearchQuery(t.value);
    window.clearTimeout(participantSearchDebounceId);
    participantSearchDebounceId = window.setTimeout(() => runSearchRefresh(t.value), ARENA_SEARCH_REFRESH_MS);
  });
  document.addEventListener("search", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("participant-search-input")) return;
    window.clearTimeout(participantSearchDebounceId);
    setParticipantSearchQuery(t.value);
    runSearchRefresh(t.value);
  });
  document.addEventListener("click", (e) => {
    const btn = e.target instanceof Element ? e.target.closest("[data-participant-sort-toggle]") : null;
    if (!btn) return;
    cycleParticipantSortMode();
    syncParticipantSortButtons();
    onSearchChange();
  });
}

function updateSessionBar(session) {
  updateSyncLiveBadge();
  const chip = $("#session-chip");
  const nameEl = $("#session-name");
  const btn = $("#btn-cambiar-sesion");
  if (btn && isArenaMode()) btn.textContent = "Salir";
  const settingsBtn = $("#btn-admin-settings");
  const p = session ? getParticipantById(session.participantId) : null;
  const showBar = Boolean(p);
  if (showBar) {
    if (chip) chip.hidden = false;
    if (btn) btn.hidden = false;
    if (nameEl) nameEl.textContent = p.name;
    if (settingsBtn) {
      if (isArenaMode()) {
        settingsBtn.hidden = false;
        settingsBtn.style.display = "";
        settingsBtn.disabled = false;
        settingsBtn.title = isArenaAdmin()
          ? "Ajustes de cuenta y administración"
          : "Ajustes de cuenta";
      } else {
        const isAdmin = canEditOfficialResults(session.participantId);
        settingsBtn.hidden = !isAdmin;
        settingsBtn.style.display = !isAdmin ? "none" : "";
        settingsBtn.disabled = !isAdmin;
      }
    }
  } else {
    if (chip) chip.hidden = true;
    if (btn) btn.hidden = true;
    if (nameEl) nameEl.textContent = "";
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
  void renderAdminBackupSection();
  overlay.hidden = false;
}

function formatBackupDate(iso) {
  try {
    return new Date(iso).toLocaleString("es", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(iso ?? "");
  }
}

function formatBackupSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function setAdminBackupStatus(message, isError = false) {
  const el = $("#admin-backup-status");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("admin-settings-backup-status--error", isError);
}

async function renderAdminBackupSection() {
  const serverWrap = $("#admin-backup-server-wrap");
  const listEl = $("#admin-backup-server-list");
  const emptyEl = $("#admin-backup-server-empty");
  const maxEl = $("#admin-backup-max-count");
  if (!serverWrap || !listEl) return;

  if (!isRemoteSyncActive()) {
    serverWrap.hidden = true;
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.hidden = true;
    return;
  }

  serverWrap.hidden = false;
  listEl.innerHTML = `<li class="muted">Cargando copias del servidor…</li>`;
  if (emptyEl) emptyEl.hidden = true;

  const data = await fetchBackupsList();
  if (!data || !Array.isArray(data.backups)) {
    listEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.textContent = "No se pudo cargar la lista de copias del servidor.";
      emptyEl.hidden = false;
    }
    return;
  }

  if (maxEl && data.maxBackups) maxEl.textContent = String(data.maxBackups);

  if (data.backups.length === 0) {
    listEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.textContent = "Aún no hay copias automáticas en el servidor.";
      emptyEl.hidden = false;
    }
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  const recent = data.backups.slice(0, 8);
  listEl.innerHTML = recent
    .map(
      (b) => `<li class="admin-settings-backup-row">
        <span class="admin-settings-backup-row-meta">
          <strong>${escapeHtml(formatBackupDate(b.createdAt))}</strong>
          <span class="muted">${escapeHtml(formatBackupSize(b.size))}</span>
        </span>
        <button type="button" class="btn btn-sm admin-settings-backup-restore" data-backup-file="${escapeHtmlAttr(
          b.filename,
        )}">Restaurar</button>
      </li>`,
    )
    .join("");

  listEl.querySelectorAll(".admin-settings-backup-restore").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const session = loadSession();
      if (!session || !canEditOfficialResults(session.participantId)) return;
      const filename = btn.getAttribute("data-backup-file");
      if (!filename) return;
      if (
        !confirm(
          `¿Restaurar la copia del ${formatBackupDate(
            recent.find((x) => x.filename === filename)?.createdAt ?? "",
          )}? Sustituirá predicciones, resultados oficiales y participantes actuales.`,
        )
      ) {
        return;
      }
      if (!confirm("Última confirmación: esta acción no se puede deshacer fácilmente. ¿Continuar?")) return;
      setAdminBackupStatus("Restaurando copia del servidor…");
      try {
        const res = await restoreServerBackup(filename);
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (body.data) applyRemoteState(body.data);
        setAdminBackupStatus("Copia restaurada correctamente.");
        closeAdminSettingsOverlay();
        refreshAll(loadSession());
      } catch {
        setAdminBackupStatus("No se pudo restaurar la copia del servidor.", true);
      }
    });
  });
}

function closeAdminSettingsOverlay() {
  const o = $("#overlay-admin-settings");
  if (o) o.hidden = true;
}

function closeArenaAccountOverlay() {
  const o = $("#overlay-arena-account");
  if (o) o.hidden = true;
}

function setArenaAccountError(el, message) {
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

/** @type {Array<{ username: string, displayName: string, isAdmin: boolean, isPrivadas?: boolean, deviceBanned?: boolean, hasDevice?: boolean }>} */
let arenaAdminUsersCache = [];

function filterArenaAdminUsers(users, query) {
  const q = normalizeForSearch(query);
  if (!q) return users;
  return users.filter(
    (u) =>
      normalizeForSearch(u.username).includes(q) || normalizeForSearch(u.displayName).includes(q),
  );
}

async function reloadArenaAdminUsersList() {
  arenaAdminUsersCache = await arenaAdminListUsers();
  const q = String($("#arena-admin-user-search")?.value ?? "").trim();
  renderArenaAdminUserResults(filterArenaAdminUsers(arenaAdminUsersCache, q));
}

function renderArenaAdminUserResults(users) {
  const wrap = $("#arena-admin-user-results");
  const errEl = $("#arena-admin-user-error");
  if (!wrap) return;
  setArenaAccountError(errEl, "");
  const session = loadSession();
  const myId = session?.participantId ?? "";
  if (!users.length) {
    wrap.innerHTML = `<p class="muted">${
      arenaAdminUsersCache.length
        ? "Ningún jugador coincide con la búsqueda."
        : "No hay participantes registrados."
    }</p>`;
    return;
  }
  wrap.innerHTML = `<ul class="admin-settings-list" aria-label="Participantes de Arena">
    ${users
      .map((u) => {
        const isSelf = u.username === myId;
        const tags = [
          u.isAdmin ? "admin" : "",
          u.isPrivadas ? "privadas" : "",
          u.deviceBanned ? "dispositivo baneado" : "",
        ]
          .filter(Boolean)
          .map((t) => `<span class="arena-admin-user-tag">${escapeHtml(t)}</span>`)
          .join("");
        const actions = isSelf
          ? `<span class="muted arena-admin-user-self-hint">Tu cuenta</span>`
          : `<div class="arena-admin-user-actions">
              <button type="button" class="btn btn-sm" data-arena-delete-user="${escapeHtmlAttr(u.username)}">Eliminar</button>
              <button type="button" class="btn btn-sm admin-settings-danger-btn" data-arena-ban-user="${escapeHtmlAttr(u.username)}"${
                u.isAdmin ? " disabled" : ""
              }>Banear</button>
            </div>`;
        return `<li class="admin-settings-row admin-settings-row--arena-user">
          <span class="admin-settings-row-meta">
            <strong>${escapeHtml(u.displayName)}${isSelf ? " (tú)" : ""}</strong>
            <span class="muted">${escapeHtml(u.username)}</span>
            ${tags ? `<span class="arena-admin-user-tags">${tags}</span>` : ""}
          </span>
          ${actions}
        </li>`;
      })
      .join("")}
  </ul>`;
  wrap.querySelectorAll("[data-arena-delete-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const username = btn.getAttribute("data-arena-delete-user");
      if (!username) return;
      const match = users.find((u) => u.username === username);
      const label = match?.displayName ?? username;
      if (
        !confirm(
          `¿Eliminar a ${label} (${username})? Se borrarán sus predicciones y mensajes de chat. Podrá volver a registrarse en el mismo dispositivo.`,
        )
      ) {
        return;
      }
      btn.disabled = true;
      try {
        await arenaAdminDeleteUser(username);
        setArenaAccountError(errEl, "");
        await reloadArenaAdminUsersList();
        refreshAll(loadSession());
      } catch (e) {
        setArenaAccountError(errEl, e instanceof Error ? e.message : "No se pudo eliminar el usuario.");
        btn.disabled = false;
      }
    });
  });
  wrap.querySelectorAll("[data-arena-ban-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const username = btn.getAttribute("data-arena-ban-user");
      if (!username) return;
      const match = users.find((u) => u.username === username);
      const label = match?.displayName ?? username;
      if (
        !confirm(
          `¿Banear a ${label} (${username})?\n\nSe eliminará su cuenta y su dispositivo no podrá crear otra cuenta en Arena.`,
        )
      ) {
        return;
      }
      if (!confirm("Última confirmación: ¿banear este usuario y su dispositivo?")) return;
      btn.disabled = true;
      try {
        await arenaAdminBanUser(username);
        setArenaAccountError(errEl, "");
        await reloadArenaAdminUsersList();
        refreshAll(loadSession());
      } catch (e) {
        setArenaAccountError(errEl, e instanceof Error ? e.message : "No se pudo banear al usuario.");
        btn.disabled = false;
      }
    });
  });
}

function setArenaAdminBackupStatus(message, isError = false) {
  const el = $("#arena-admin-backup-status");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("admin-settings-backup-status--error", isError);
}

async function renderArenaAdminBackupSection() {
  const listEl = $("#arena-admin-backup-server-list");
  const emptyEl = $("#arena-admin-backup-server-empty");
  const maxEl = $("#arena-admin-backup-max-count");
  if (!listEl) return;
  listEl.innerHTML = `<li class="muted">Cargando copias del servidor…</li>`;
  if (emptyEl) emptyEl.hidden = true;
  const data = await arenaAdminListBackups();
  if (!data || !Array.isArray(data.backups)) {
    listEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.textContent = "No se pudo cargar la lista de copias del servidor.";
      emptyEl.hidden = false;
    }
    return;
  }
  if (maxEl && data.maxBackups) maxEl.textContent = String(data.maxBackups);
  if (data.backups.length === 0) {
    listEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.textContent = "Aún no hay copias automáticas en el servidor.";
      emptyEl.hidden = false;
    }
    return;
  }
  if (emptyEl) emptyEl.hidden = true;
  const recent = data.backups.slice(0, 8);
  listEl.innerHTML = recent
    .map(
      (b) => `<li class="admin-settings-backup-row">
        <span class="admin-settings-backup-row-meta">
          <strong>${escapeHtml(formatBackupDate(b.createdAt))}</strong>
          <span class="muted">${escapeHtml(formatBackupSize(b.size))}</span>
        </span>
        <button type="button" class="btn btn-sm admin-settings-backup-restore" data-arena-backup-file="${escapeHtmlAttr(
          b.filename,
        )}">Restaurar</button>
      </li>`,
    )
    .join("");
  listEl.querySelectorAll("[data-arena-backup-file]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!isArenaAdmin()) return;
      const filename = btn.getAttribute("data-arena-backup-file");
      if (!filename) return;
      const meta = recent.find((x) => x.filename === filename);
      if (
        !confirm(
          `¿Restaurar la copia del ${formatBackupDate(meta?.createdAt ?? "")}? Se sustituirán usuarios, predicciones, resultados oficiales y chat de Arena.`,
        )
      ) {
        return;
      }
      if (!confirm("Última confirmación: esta acción no se puede deshacer fácilmente. ¿Continuar?")) return;
      setArenaAdminBackupStatus("Restaurando copia del servidor…");
      try {
        const res = await arenaAdminRestoreBackupFile(filename);
        const pre = res?.preRestoreBackup ? ` Se guardó «${res.preRestoreBackup}» antes.` : "";
        setArenaAdminBackupStatus(`Copia restaurada correctamente.${pre}`);
        closeArenaAccountOverlay();
        refreshAll(loadSession());
        void renderArenaAdminBackupSection();
      } catch (e) {
        setArenaAdminBackupStatus(e instanceof Error ? e.message : "Error al restaurar.", true);
      }
    });
  });
}

function openArenaAccountOverlay() {
  const session = loadSession();
  if (!session) return;
  const overlay = $("#overlay-arena-account");
  if (!overlay) return;
  const p = getParticipantById(session.participantId);
  const au = getArenaUser();
  const nameEl = $("#arena-account-self-name");
  const userEl = $("#arena-account-self-username");
  if (nameEl) nameEl.textContent = p?.name ?? au?.displayName ?? session.participantId;
  if (userEl) userEl.textContent = session.participantId;
  setArenaAccountError($("#arena-account-self-error"), "");
  setArenaAccountError($("#arena-admin-user-error"), "");
  const adminWrap = $("#arena-account-admin-wrap");
  const searchInput = $("#arena-admin-user-search");
  const resultsWrap = $("#arena-admin-user-results");
  if (adminWrap) adminWrap.hidden = !isArenaAdmin();
  if (searchInput) searchInput.value = "";
  if (resultsWrap) resultsWrap.innerHTML = `<p class="muted">Cargando participantes…</p>`;
  arenaAdminUsersCache = [];
  if (isArenaAdmin()) {
    setArenaAdminBackupStatus("");
    void renderArenaAdminBackupSection();
    void reloadArenaAdminUsersList().catch((e) => {
      setArenaAccountError(
        $("#arena-admin-user-error"),
        e instanceof Error ? e.message : "No se pudo cargar la lista de participantes.",
      );
      if (resultsWrap) resultsWrap.innerHTML = "";
    });
  } else if (resultsWrap) {
    resultsWrap.innerHTML = "";
  }
  const deleteBtn = $("#btn-arena-delete-my-account");
  if (deleteBtn) {
    deleteBtn.hidden = isArenaPrivadasMirrorUser();
    deleteBtn.disabled = isArenaPrivadasMirrorUser();
  }
  overlay.hidden = false;
  searchInput?.focus();
}

function bindArenaAccountSettings() {
  const overlay = $("#overlay-arena-account");
  const closeBtn = $("#arena-account-close");
  const deleteBtn = $("#btn-arena-delete-my-account");
  const searchInput = $("#arena-admin-user-search");
  const downloadBackupBtn = $("#btn-arena-admin-download-backup");
  const backupFileInput = $("#arena-admin-backup-file-input");
  if (!overlay) return;

  let searchTimer = null;

  downloadBackupBtn?.addEventListener("click", () => {
    if (!isArenaAdmin()) return;
    setArenaAdminBackupStatus("Generando backup…");
    void arenaAdminExportBackup()
      .then((envelope) => {
        const json = JSON.stringify(envelope, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        a.href = url;
        a.download = `arena-backup-${ts}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setArenaAdminBackupStatus("Backup descargado.");
      })
      .catch(() => {
        setArenaAdminBackupStatus("No se pudo generar el backup.", true);
      });
  });

  backupFileInput?.addEventListener("change", async () => {
    if (!isArenaAdmin()) return;
    const file = backupFileInput.files?.[0];
    backupFileInput.value = "";
    if (!file) return;
    if (
      !confirm(
        "¿Restaurar desde este archivo? Se sustituirán usuarios, predicciones, resultados oficiales y chat de Arena.",
      )
    ) {
      return;
    }
    if (!confirm("Última confirmación: ¿continuar con la restauración?")) return;
    setArenaAdminBackupStatus("Restaurando backup…");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await arenaAdminRestoreBackupUpload(parsed);
      const pre = res?.preRestoreBackup ? ` Se guardó «${res.preRestoreBackup}» antes.` : "";
      setArenaAdminBackupStatus(`Backup restaurado correctamente.${pre}`);
      closeArenaAccountOverlay();
      refreshAll(loadSession());
      void renderArenaAdminBackupSection();
    } catch {
      setArenaAdminBackupStatus("Archivo inválido o error al restaurar.", true);
    }
  });

  closeBtn?.addEventListener("click", () => closeArenaAccountOverlay());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeArenaAccountOverlay();
  });

  deleteBtn?.addEventListener("click", async () => {
    const errEl = $("#arena-account-self-error");
    setArenaAccountError(errEl, "");
    if (
      !confirm(
        "¿Eliminar tu cuenta de forma permanente? Se borrarán tus predicciones y no podrás recuperarlas.",
      )
    ) {
      return;
    }
    if (!confirm("Última confirmación: esta acción no se puede deshacer. ¿Continuar?")) return;
    deleteBtn.disabled = true;
    try {
      await arenaDeleteMyAccount();
      clearSession();
      closeArenaAccountOverlay();
    } catch (e) {
      setArenaAccountError(errEl, e instanceof Error ? e.message : "No se pudo eliminar la cuenta.");
      deleteBtn.disabled = false;
    }
  });

  searchInput?.addEventListener("input", () => {
    if (searchTimer != null) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      searchTimer = null;
      const q = String(searchInput.value ?? "").trim();
      renderArenaAdminUserResults(filterArenaAdminUsers(arenaAdminUsersCache, q));
    }, 120);
  });
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
  const downloadBackupBtn = $("#btn-admin-download-backup");
  const backupFileInput = $("#admin-backup-file-input");
  if (!openBtn || !overlay || !form) return;

  downloadBackupBtn?.addEventListener("click", () => {
    const session = loadSession();
    if (!session || !canEditOfficialResults(session.participantId)) return;
    try {
      downloadBackupFile();
      setAdminBackupStatus("Backup descargado.");
    } catch {
      setAdminBackupStatus("No se pudo generar el backup.", true);
    }
  });

  backupFileInput?.addEventListener("change", async () => {
    const session = loadSession();
    if (!session || !canEditOfficialResults(session.participantId)) return;
    const file = backupFileInput.files?.[0];
    backupFileInput.value = "";
    if (!file) return;
    if (
      !confirm(
        "¿Restaurar desde este archivo? Se sustituirán predicciones, resultados oficiales y la lista de participantes.",
      )
    ) {
      return;
    }
    if (!confirm("Última confirmación: ¿continuar con la restauración?")) return;
    setAdminBackupStatus("Restaurando backup…");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await restoreFromBackupFile(parsed);
      setAdminBackupStatus("Backup restaurado correctamente.");
      closeAdminSettingsOverlay();
      refreshAll(loadSession());
      void renderAdminBackupSection();
    } catch {
      setAdminBackupStatus("Archivo inválido o error al restaurar.", true);
    }
  });

  openBtn.addEventListener("click", () => {
    const session = loadSession();
    if (!session) return;
    if (isArenaMode()) {
      openArenaAccountOverlay();
      return;
    }
    if (!canEditOfficialResults(session.participantId)) return;
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

/** Bloqueo manual del admin en predicciones generales. */
function generalesPredictionsAdminBlocked() {
  return loadOfficialResults().generalPredictionsBlockedForParticipants === true;
}

/** Pestaña Predicciones generales: nadie puede editar el formulario de participante (incl. admin). */
function generalesPredictionsFormLocked() {
  if (isArenaPrivadasMirrorUser()) return true;
  return generalesPredictionsAdminBlocked() || isAnyTournamentMatchKickoffLocked();
}

/** Fase de grupos: bloqueo global de predicciones para todos (incl. admin). */
function groupPredictionsFormLocked() {
  if (isArenaPrivadasMirrorUser()) return true;
  if (isArenaMode()) return isAnyTournamentMatchKickoffLocked();
  return loadOfficialResults().groupPredictionsBlockedForAll === true;
}

function arenaPrivadasReadOnlyBannerHtml() {
  if (!isArenaPrivadasMirrorUser()) return "";
  return `<p class="generales-locked-banner muted" role="status">Jugador de la <strong>quiniela privada</strong>: tus predicciones se guardan en Predicciones Amigos. En Arena solo puedes consultar rankings y tablas; usa el mismo usuario y PIN de 8 caracteres para entrar.</p>`;
}

function scheduleArenaGeneralesDeadlineRefresh(onDeadline) {
  if (!isArenaMode()) return;
  const deadline = arenaGeneralesGroupsDeadlineMs();
  const delay = deadline - Date.now();
  if (delay <= 0) return;
  window.setTimeout(() => {
    onDeadline();
    scheduleArenaGeneralesDeadlineRefresh(onDeadline);
  }, delay + 100);
}

/** @type {ReturnType<typeof setInterval> | null} */
let arenaDeadlineCountdownInterval = null;

function arenaDeadlineCountdownOpen() {
  return isArenaMode() && !isArenaGeneralesAndGroupsLocked();
}

function arenaDeadlineCountdownBannerHtml() {
  const label = arenaGeneralesGroupsDeadlineDateLabelSpanish();
  const countdown = formatArenaGeneralesGroupsCountdown();
  if (!countdown) return "";
  return `<p class="arena-deadline-countdown generales-locked-banner" role="status" data-arena-deadline-countdown>
    Las predicciones cierran el <strong>${escapeHtml(label)}</strong> (hora CDMX).
    <span class="arena-deadline-countdown__timer" data-arena-deadline-countdown-timer aria-live="polite">${escapeHtml(countdown)}</span>
  </p>`;
}

function syncArenaDeadlineCountdownTimers() {
  const text = formatArenaGeneralesGroupsCountdown();
  document.querySelectorAll("[data-arena-deadline-countdown-timer]").forEach((el) => {
    el.textContent = text ?? "";
  });
  if (!text) {
    document.querySelectorAll("[data-arena-deadline-countdown]").forEach((el) => el.remove());
    if (arenaDeadlineCountdownInterval != null) {
      window.clearInterval(arenaDeadlineCountdownInterval);
      arenaDeadlineCountdownInterval = null;
    }
  }
}

function scheduleArenaDeadlineCountdownInterval() {
  if (!arenaDeadlineCountdownOpen()) {
    if (arenaDeadlineCountdownInterval != null) {
      window.clearInterval(arenaDeadlineCountdownInterval);
      arenaDeadlineCountdownInterval = null;
    }
    return;
  }
  if (arenaDeadlineCountdownInterval != null) return;
  arenaDeadlineCountdownInterval = window.setInterval(() => {
    syncArenaDeadlineCountdownTimers();
    if (!formatArenaGeneralesGroupsCountdown()) {
      refreshAll(loadSession(), { preserveScroll: true, onlyActivePanel: true });
    }
  }, 1000);
}

/** @param {ParentNode} host @param {Element | null} [insertBefore] */
function ensureArenaDeadlineCountdown(host, insertBefore = null) {
  if (!host) return;
  if (!arenaDeadlineCountdownOpen()) {
    host.querySelector("[data-arena-deadline-countdown]")?.remove();
    return;
  }
  let banner = host.querySelector("[data-arena-deadline-countdown]");
  if (!banner) {
    const wrap = document.createElement("div");
    wrap.innerHTML = arenaDeadlineCountdownBannerHtml();
    banner = wrap.firstElementChild;
    if (banner) {
      if (insertBefore) host.insertBefore(banner, insertBefore);
      else host.appendChild(banner);
    }
  }
  const timer = banner?.querySelector("[data-arena-deadline-countdown-timer]");
  if (timer) timer.textContent = formatArenaGeneralesGroupsCountdown() ?? "";
  scheduleArenaDeadlineCountdownInterval();
}

function syncArenaGruposPanelCountdown() {
  const panel = $("#panel-grupos");
  if (!panel) return;
  const anchor =
    panel.querySelector("#group-third-limit-msg") ??
    panel.querySelector(".fase-grupos-toolbar") ??
    panel.querySelector("#grupos-wrap");
  ensureArenaDeadlineCountdown(panel, anchor);
}

function bindSessionChange(handler) {
  $("#btn-cambiar-sesion").addEventListener("click", () => {
    if (isArenaMode()) {
      if (confirm("¿Salir de tu cuenta?")) {
        clearSession();
        arenaLogout();
      }
      return;
    }
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
 * @param {Record<string, string>} g
 * @param {boolean} disabled
 */
function generalesPodiumFormFieldsHtml(g, disabled) {
  const row = (name, label, medalClass, stepClass) => {
    const meta = PODIUM_FIELD_META[name] ?? { placeholder: "Buscar selección…", label: name };
    return `
    <label class="field generales-podium-slot ${medalClass} ${stepClass}">
      <span class="field-label">${label}</span>
      ${buildSearchPickerHtml({
        fieldName: name,
        role: "team",
        currentValue: g[name] ?? "",
        disabled,
        label: meta.label,
        placeholder: meta.placeholder,
      })}
    </label>`;
  };
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
 * @param {Record<string, string>} g
 * @param {boolean} disabled
 */
function generalesFullFormInnerHtml(g, disabled) {
  return `
    <div class="generales-form-layout">
      <section class="generales-block generales-block--podium" aria-label="Podio final">
        <h3 class="generales-side-title">Podio</h3>
        <div class="generales-podium-slots">
          ${generalesPodiumFormFieldsHtml(g, disabled)}
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

/** @type {Map<string, SquadEntry[]>} */
const awardEntriesByRoleCache = new Map([
  ["gk", getSquadEntriesByRole("gk")],
  ["outfield", getSquadEntriesByRole("outfield")],
]);
const awardAllNames = new Set(SQUAD_ENTRIES.map((e) => e.name));
/** @type {Map<string, string>} */
const awardPlayerCountryByName = new Map(SQUAD_ENTRIES.map((e) => [e.name, e.country]));
/** @type {{ name: string, groupId: string }[]} */
const PODIUM_TEAM_ENTRIES = GROUPS.flatMap((grp) =>
  grp.teams.filter((t) => !isPlaceholderTeam(t)).map((name) => ({ name, groupId: grp.id })),
).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
const podiumTeamNames = new Set(PODIUM_TEAM_ENTRIES.map((e) => e.name));
let awardComboboxDocClickWired = false;

const PODIUM_FIELD_META = {
  first: { placeholder: "Buscar campeón…", label: "Campeón" },
  second: { placeholder: "Buscar subcampeón…", label: "Subcampeón" },
  third: { placeholder: "Buscar tercer lugar…", label: "Tercer lugar" },
};

const AWARD_FIELD_META = {
  bestPlayer: { role: "outfield", placeholder: "Buscar jugador…", label: "Mejor jugador" },
  bestGk: { role: "gk", placeholder: "Buscar portero…", label: "Mejor portero" },
  topScorer: { role: "outfield", placeholder: "Buscar jugador…", label: "Goleador del torneo" },
};

const PODIUM_SLOT_NAMES = ["first", "second", "third"];

function normalizeAwardSearchText(s) {
  return normalizeForSearch(s);
}

/** @param {string} playerName */
function playerLabelHtml(playerName) {
  const name = String(playerName ?? "").trim();
  if (!name) return "";
  const country = awardPlayerCountryByName.get(name) ?? "";
  return `
    <span class="team-label">
      ${getTeamFlagImgHtml(country || name)}
      <span class="team-text">${escapeHtml(name)}</span>
    </span>
  `;
}

/** @param {string} role @param {string} value */
function awardPickerDisplayHtml(role, value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return role === "team" ? teamLabelHtml(v) : playerLabelHtml(v);
}

/** @param {Element} box */
function updateAwardComboboxDisplay(box) {
  const role = box.dataset.awardRole ?? "outfield";
  const hidden = /** @type {HTMLInputElement | null} */ (box.querySelector('input[type="hidden"]'));
  const picked = box.querySelector(".award-combobox__picked");
  if (!hidden || !picked) return;
  const val = hidden.value.trim();
  if (val) {
    box.classList.add("has-value");
    picked.innerHTML = awardPickerDisplayHtml(role, val);
    picked.hidden = false;
  } else {
    box.classList.remove("has-value");
    picked.innerHTML = "";
    picked.hidden = true;
  }
}

/** @param {ParentNode} root */
function updateAllAwardComboboxDisplays(root) {
  root.querySelectorAll(".award-combobox").forEach(updateAwardComboboxDisplay);
}

/**
 * @param {{ fieldName: string, role: string, currentValue: string, disabled: boolean, label: string, placeholder: string }} opts
 */
function buildSearchPickerHtml(opts) {
  const { fieldName, role, currentValue, disabled, label, placeholder } = opts;
  const cur = String(currentValue ?? "").trim();
  const dis = disabled ? "disabled" : "";
  return `
    <div class="award-combobox" data-award-field="${fieldName}" data-award-role="${role}">
      <input type="hidden" name="${fieldName}" value="${escapeHtml(cur)}">
      <div class="award-combobox__field">
        <span class="award-combobox__picked" hidden aria-hidden="true"></span>
        <input
          type="search"
          class="input award-combobox__search"
          placeholder="${escapeHtml(placeholder)}"
          value="${escapeHtml(cur)}"
          autocomplete="off"
          ${dis}
          aria-label="${escapeHtml(label)}"
          aria-autocomplete="list"
          aria-expanded="false"
        />
      </div>
      <ul class="award-combobox__list" role="listbox" hidden></ul>
    </div>`;
}

/** @param {string} fieldName @param {string} currentValue @param {boolean} disabled */
function buildAwardPickerHtml(fieldName, currentValue, disabled) {
  const meta = AWARD_FIELD_META[fieldName] ?? { role: "outfield", placeholder: "Buscar…", label: fieldName };
  return buildSearchPickerHtml({
    fieldName,
    role: meta.role,
    currentValue,
    disabled,
    label: meta.label,
    placeholder: meta.placeholder,
  });
}

/**
 * @param {HTMLFormElement} form
 * @param {() => void} onCommit
 */
function wireGeneralesAwardComboboxes(form, onCommit) {
  function closeAllAwardLists(except) {
    form.querySelectorAll(".award-combobox").forEach((box) => {
      if (except && box === except) return;
      const list = box.querySelector(".award-combobox__list");
      const search = box.querySelector(".award-combobox__search");
      if (list) list.hidden = true;
      if (search) search.setAttribute("aria-expanded", "false");
    });
  }

  function renderAwardList(box, query) {
    const role = box.dataset.awardRole ?? "outfield";
    const list = box.querySelector(".award-combobox__list");
    const search = /** @type {HTMLInputElement | null} */ (box.querySelector(".award-combobox__search"));
    const hidden = /** @type {HTMLInputElement | null} */ (box.querySelector(`input[type="hidden"][name="${box.dataset.awardField}"]`));
    if (!list || !search || !hidden) return;

    const q = normalizeAwardSearchText(query);
    const isTeam = role === "team";
    const playerEntries = awardEntriesByRoleCache.get(role) ?? [];
    const teamEntries = PODIUM_TEAM_ENTRIES;
    const poolSize = isTeam ? teamEntries.length : playerEntries.length;

    if (!q) {
      list.innerHTML = `<li class="award-combobox__empty muted" aria-hidden="true">Escribe para buscar entre ${poolSize} ${isTeam ? "selecciones" : "convocados"}</li>`;
      list.hidden = false;
      search.setAttribute("aria-expanded", "true");
      return;
    }

    const cur = normalizeTeamName(hidden.value.trim());
    let orphan = "";
    if (isTeam) {
      if (cur && !podiumTeamNames.has(cur)) {
        orphan = `<li class="award-combobox__option award-combobox__option--orphan award-combobox__option--team" role="option" data-value="${escapeHtml(cur)}"><span class="award-combobox__option-name">${teamLabelHtml(cur)}</span><span class="muted">· fuera de lista</span></li>`;
      }
    } else if (cur && !awardAllNames.has(cur)) {
      orphan = `<li class="award-combobox__option award-combobox__option--orphan award-combobox__option--player" role="option" data-value="${escapeHtml(cur)}"><span class="award-combobox__option-name">${playerLabelHtml(cur)}</span><span class="muted">· fuera de lista</span></li>`;
    }

    let matches;
    if (isTeam) {
      matches = teamEntries.filter((e) => {
        const hay = normalizeAwardSearchText(`${e.name} grupo ${e.groupId}`);
        return hay.includes(q);
      });
    } else {
      matches = playerEntries.filter((e) => {
        const hay = normalizeAwardSearchText(`${e.name} ${e.country}`);
        return hay.includes(q);
      });
    }

    if (matches.length === 0 && !orphan) {
      list.innerHTML = `<li class="award-combobox__empty muted" aria-hidden="true">Sin coincidencias</li>`;
    } else if (isTeam) {
      list.innerHTML =
        orphan +
        matches
          .map(
            (e) =>
              `<li class="award-combobox__option award-combobox__option--team" role="option" data-value="${escapeHtml(e.name)}"><span class="award-combobox__option-name">${teamLabelHtml(e.name)}</span><span class="award-combobox__option-country muted">Grupo ${escapeHtml(e.groupId)}</span></li>`,
          )
          .join("");
    } else {
      list.innerHTML =
        orphan +
        matches
          .map(
            (e) =>
              `<li class="award-combobox__option award-combobox__option--player" role="option" data-value="${escapeHtml(e.name)}"><span class="award-combobox__option-name">${playerLabelHtml(e.name)}</span><span class="award-combobox__option-country muted">${escapeHtml(e.country)}</span></li>`,
          )
          .join("");
    }

    list.hidden = false;
    search.setAttribute("aria-expanded", "true");
  }

  function setPickerSlotValue(field, value) {
    const hidden = /** @type {HTMLInputElement | null} */ (
      form.querySelector(`input[type="hidden"][name="${field}"]`)
    );
    const box = form.querySelector(`.award-combobox[data-award-field="${field}"]`);
    const search = box?.querySelector(".award-combobox__search");
    if (hidden) hidden.value = value;
    if (search instanceof HTMLInputElement) search.value = value;
    if (box) updateAwardComboboxDisplay(box);
  }

  function pickAward(box, value) {
    const field = box.dataset.awardField ?? "";
    const search = /** @type {HTMLInputElement | null} */ (box.querySelector(".award-combobox__search"));
    const hidden = /** @type {HTMLInputElement | null} */ (box.querySelector(`input[type="hidden"][name="${field}"]`));
    const list = box.querySelector(".award-combobox__list");
    if (!search || !hidden) return;

    if (PODIUM_SLOT_NAMES.includes(field)) {
      const prevSelf = box.dataset.prevPodiumPick ?? hidden.value;
      setPickerSlotValue(field, value);
      if (value !== "") {
        for (const otherName of PODIUM_SLOT_NAMES) {
          if (otherName === field) continue;
          const otherHidden = /** @type {HTMLInputElement | null} */ (
            form.querySelector(`input[type="hidden"][name="${otherName}"]`)
          );
          if (otherHidden && otherHidden.value === value) {
            setPickerSlotValue(otherName, prevSelf);
            const otherBox = form.querySelector(`.award-combobox[data-award-field="${otherName}"]`);
            if (otherBox) otherBox.dataset.prevPodiumPick = prevSelf;
          }
        }
      }
      box.dataset.prevPodiumPick = value;
    } else {
      hidden.value = value;
      search.value = value;
    }

    if (list) list.hidden = true;
    search.setAttribute("aria-expanded", "false");
    updateAwardComboboxDisplay(box);
    onCommit();
  }

  form.querySelectorAll(".award-combobox").forEach((box) => {
    const search = /** @type {HTMLInputElement | null} */ (box.querySelector(".award-combobox__search"));
    const list = box.querySelector(".award-combobox__list");
    if (!search || !list || search.disabled) return;

    search.addEventListener("focus", () => {
      const field = box.dataset.awardField ?? "";
      const hiddenEl = /** @type {HTMLInputElement | null} */ (
        form.querySelector(`input[type="hidden"][name="${field}"]`)
      );
      if (PODIUM_SLOT_NAMES.includes(field)) {
        box.dataset.prevPodiumPick = hiddenEl?.value ?? "";
      }
      closeAllAwardLists(box);
      renderAwardList(box, search.value);
    });
    search.addEventListener("input", () => {
      renderAwardList(box, search.value);
    });
    search.addEventListener("search", () => {
      if (search.value.trim() === "") {
        pickAward(box, "");
      }
    });
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllAwardLists(null);
        search.blur();
      }
    });
    search.addEventListener("blur", () => {
      window.setTimeout(() => {
        if (!box.contains(document.activeElement)) {
          list.hidden = true;
          search.setAttribute("aria-expanded", "false");
          const field = box.dataset.awardField ?? "";
          const hidden = /** @type {HTMLInputElement | null} */ (
            box.querySelector(`input[type="hidden"][name="${field}"]`)
          );
          if (!hidden) return;
          const sv = search.value.trim();
          const hv = hidden.value.trim();
          if (sv === "") {
            if (hv !== "") pickAward(box, "");
          } else if (sv !== hv) {
            search.value = hidden.value;
          }
        }
      }, 120);
    });

    list.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const li = e.target.closest(".award-combobox__option");
      if (!li) return;
      pickAward(box, li.dataset.value ?? "");
    });
  });

  if (!awardComboboxDocClickWired) {
    awardComboboxDocClickWired = true;
    document.addEventListener("click", (e) => {
      if (e.target.closest(".award-combobox")) return;
      document.querySelectorAll(".award-combobox__list").forEach((list) => {
        list.hidden = true;
      });
      document.querySelectorAll(".award-combobox__search").forEach((search) => {
        search.setAttribute("aria-expanded", "false");
      });
    });
  }

  updateAllAwardComboboxDisplays(form);
}

/** Sincroniza inputs visibles con los hidden tras re-render. */
function syncGeneralesPickerValues(form, general) {
  for (const key of ["first", "second", "third", "bestPlayer", "bestGk", "topScorer"]) {
    const hidden = /** @type {HTMLInputElement | null} */ (form.querySelector(`input[type="hidden"][name="${key}"]`));
    const search = form.querySelector(`.award-combobox[data-award-field="${key}"] .award-combobox__search`);
    const val = String(general?.[key] ?? "");
    if (hidden) hidden.value = val;
    if (search instanceof HTMLInputElement) search.value = val;
  }
  updateAllAwardComboboxDisplays(form);
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
  return `
    <label class="field generales-award-slot generales-award-slot--player">
      <span class="field-label">Mejor jugador</span>
      ${buildAwardPickerHtml("bestPlayer", g.bestPlayer, disabled)}
    </label>
    <label class="field generales-award-slot generales-award-slot--gk">
      <span class="field-label">Mejor portero</span>
      ${buildAwardPickerHtml("bestGk", g.bestGk, disabled)}
    </label>
    <label class="field generales-award-slot generales-award-slot--scorer">
      <span class="field-label">Goleador del torneo</span>
      ${buildAwardPickerHtml("topScorer", g.topScorer, disabled)}
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

/** @type {{ key: string, label: string, kind: "team" | "player", group: "podium" | "awards" }[]} */
const GENERALES_VOTE_SLOTS = [
  { key: "first", label: "1.º", kind: "team", group: "podium" },
  { key: "second", label: "2.º", kind: "team", group: "podium" },
  { key: "third", label: "3.º", kind: "team", group: "podium" },
  { key: "bestPlayer", label: "Mejor jugador", kind: "player", group: "awards" },
  { key: "bestGk", label: "Mejor portero", kind: "player", group: "awards" },
  { key: "topScorer", label: "Goleador", kind: "player", group: "awards" },
];

function getGeneralesVoteCountsBySlot() {
  if (isArenaMode() && hasArenaMatchVoteData()) {
    return getArenaGeneralesVoteCountsBySlot();
  }
  /** @type {Record<string, Map<string, { count: number, display: string }>>} */
  const bySlot = Object.fromEntries(GENERALES_VOTE_SLOTS.map((s) => [s.key, new Map()]));
  for (const part of getParticipantsForDisplay()) {
    const gen = loadPredictions(part.id).general ?? {};
    for (const slot of GENERALES_VOTE_SLOTS) {
      const raw = String(gen[slot.key] ?? "").trim();
      if (!raw) continue;
      const id = slot.kind === "team" ? raw : normalizeAwardText(raw);
      const map = bySlot[slot.key];
      const prev = map.get(id);
      if (prev) prev.count += 1;
      else map.set(id, { count: 1, display: raw });
    }
  }
  return bySlot;
}

/** @param {number} count @param {number} total */
function formatVotePercent(count, total) {
  if (total <= 0) return "0%";
  const pct = (count / total) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${String(rounded).replace(".", ",")}%`;
}

/**
 * @param {string} label
 * @param {Map<string, number | { count: number, display: string }>} countsMap
 */
function voteStatsTeamSlotHtml(label, countsMap) {
  const entries = [...countsMap.entries()]
    .map(([team, raw]) => {
      if (typeof raw === "number") return { display: team, count: raw };
      return { display: raw.display || team, count: raw.count };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display, "es"));
  if (entries.length === 0) return "";

  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const items = entries
    .map(
      (entry) => `<li class="generales-vote-stats-item">
        <span class="generales-vote-stats-item__label">${teamLabelHtml(entry.display)}</span>
        <span class="generales-vote-stats-item__pct">${formatVotePercent(entry.count, total)}</span>
      </li>`,
    )
    .join("");

  return `<div class="generales-vote-stats-slot">
    <h4 class="generales-vote-stats-slot__title">${escapeHtml(label)}</h4>
    <ul class="generales-vote-stats-list">${items}</ul>
  </div>`;
}

/**
 * @param {{ key: string, label: string, kind: "team" | "player", group: "podium" | "awards" }} slot
 * @param {Map<string, { count: number, display: string }>} countsMap
 */
function generalesVoteStatsSlotHtml(slot, countsMap) {
  if (slot.kind === "team") return voteStatsTeamSlotHtml(slot.label, countsMap);

  const entries = [...countsMap.values()].sort(
    (a, b) => b.count - a.count || a.display.localeCompare(b.display, "es"),
  );
  if (entries.length === 0) return "";

  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const items = entries
    .map((entry) => {
      const labelInner = playerLabelHtml(entry.display) || escapeHtml(entry.display);
      return `<li class="generales-vote-stats-item">
        <span class="generales-vote-stats-item__label">${labelInner}</span>
        <span class="generales-vote-stats-item__pct">${formatVotePercent(entry.count, total)}</span>
      </li>`;
    })
    .join("");

  return `<div class="generales-vote-stats-slot">
    <h4 class="generales-vote-stats-slot__title">${escapeHtml(slot.label)}</h4>
    <ul class="generales-vote-stats-list">${items}</ul>
  </div>`;
}

const GROUP_ORDER_VOTE_LABELS = ["1.º", "2.º", "3.º", "4.º"];

/** @param {string} groupId */
function getGroupThirdAdvanceVoteCounts(groupId) {
  if (isArenaMode() && hasArenaMatchVoteData()) {
    return getArenaGroupThirdAdvanceVoteCounts(groupId);
  }
  /** @type {{ yes: number, no: number }} */
  const counts = { yes: 0, no: 0 };
  for (const part of getParticipantsForDisplay()) {
    const v = loadPredictions(part.id).groupThirdAdvances?.[groupId];
    if (v === true) counts.yes += 1;
    else if (v === false) counts.no += 1;
  }
  return counts;
}

/** @param {string} groupId */
function buildGroupThirdAdvanceVoteSlotHtml(groupId) {
  const { yes, no } = getGroupThirdAdvanceVoteCounts(groupId);
  const total = yes + no;
  if (total === 0) {
    return `<div class="generales-vote-stats-slot">
      <h4 class="generales-vote-stats-slot__title">3.º pasa</h4>
      <p class="generales-vote-stats-slot-empty muted">Todavía no hay votos.</p>
    </div>`;
  }

  const items = [];
  if (yes > 0) {
    items.push(`<li class="generales-vote-stats-item">
      <span class="generales-vote-stats-item__label">Sí pasa <span aria-hidden="true">✓</span></span>
      <span class="generales-vote-stats-item__pct">${formatVotePercent(yes, total)}</span>
    </li>`);
  }
  if (no > 0) {
    items.push(`<li class="generales-vote-stats-item">
      <span class="generales-vote-stats-item__label">No pasa <span aria-hidden="true">✕</span></span>
      <span class="generales-vote-stats-item__pct">${formatVotePercent(no, total)}</span>
    </li>`);
  }

  return `<div class="generales-vote-stats-slot">
    <h4 class="generales-vote-stats-slot__title">3.º pasa</h4>
    <ul class="generales-vote-stats-list">${items.join("")}</ul>
  </div>`;
}

/** @param {string} groupId */
function buildGroupVoteStatsHtml(groupId) {
  if (!isArenaMode()) return "";
  const voteCountsByPos = getGroupOrderVoteCountsByPosition(groupId);
  const orderHtml = GROUP_ORDER_VOTE_LABELS.map((label, i) =>
    voteStatsTeamSlotHtml(label, voteCountsByPos[i]),
  )
    .filter(Boolean)
    .join("");
  const hasAnyOrderVotes = voteCountsByPos.some((m) => m.size > 0);
  const { yes, no } = getGroupThirdAdvanceVoteCounts(groupId);
  const hasThirdVotes = yes + no > 0;
  if (!hasAnyOrderVotes && !hasThirdVotes) return "";

  const thirdSlotHtml = buildGroupThirdAdvanceVoteSlotHtml(groupId);

  return `<section class="generales-vote-stats" aria-label="Distribución de votos del grupo ${escapeHtml(groupId)}">
    <h2 class="subsection-title generales-vote-stats__title">Distribución de votos</h2>
    <div class="generales-vote-stats-layout">
      <div class="generales-vote-stats-block">
        ${
          hasAnyOrderVotes
            ? `<h3 class="generales-side-title">Orden del grupo</h3>
        <div class="generales-vote-stats-slots generales-vote-stats-slots--group-order">${orderHtml}</div>`
            : ""
        }
        <div class="generales-vote-stats-slots generales-vote-stats-slots--third-advance">${thirdSlotHtml}</div>
      </div>
    </div>
    <p class="muted generales-vote-stats__hint">Porcentaje sobre quienes eligieron cada casilla. Solo se listan opciones con al menos un voto.</p>
  </section>`;
}

function buildGeneralesVoteStatsHtml() {
  if (!isArenaMode()) return "";
  const bySlot = getGeneralesVoteCountsBySlot();
  const podiumSlots = GENERALES_VOTE_SLOTS.filter((s) => s.group === "podium");
  const awardSlots = GENERALES_VOTE_SLOTS.filter((s) => s.group === "awards");
  const podiumHtml = podiumSlots
    .map((s) => generalesVoteStatsSlotHtml(s, bySlot[s.key]))
    .filter(Boolean)
    .join("");
  const awardsHtml = awardSlots
    .map((s) => generalesVoteStatsSlotHtml(s, bySlot[s.key]))
    .filter(Boolean)
    .join("");
  const hasAnyPodiumVotes = podiumSlots.some((s) => bySlot[s.key].size > 0);
  const hasAnyAwardVotes = awardSlots.some((s) => bySlot[s.key].size > 0);
  if (!hasAnyPodiumVotes && !hasAnyAwardVotes) return "";

  const awardsBlock = hasAnyAwardVotes
    ? `<div class="generales-vote-stats-block">
        <h3 class="generales-side-title">Premios individuales</h3>
        <div class="generales-vote-stats-slots generales-vote-stats-slots--awards">${awardsHtml}</div>
      </div>`
    : `<div class="generales-vote-stats-block">
        <h3 class="generales-side-title">Premios individuales</h3>
        <p class="generales-vote-stats-empty muted">Todavía no hay votos en premios individuales.</p>
      </div>`;

  return `<section class="generales-vote-stats" aria-label="Porcentaje de votos por opción">
    <h2 class="subsection-title generales-vote-stats__title">Distribución de votos</h2>
    <div class="generales-vote-stats-layout">
      ${
        hasAnyPodiumVotes
          ? `<div class="generales-vote-stats-block">
        <h3 class="generales-side-title">Podio</h3>
        <div class="generales-vote-stats-slots generales-vote-stats-slots--podium">${podiumHtml}</div>
      </div>`
          : ""
      }
      ${awardsBlock}
    </div>
    <p class="muted generales-vote-stats__hint">Porcentaje sobre quienes eligieron cada casilla. Solo se listan opciones con al menos un voto.</p>
  </section>`;
}

/**
 * @param {string | null | undefined} currentParticipantId
 * @param {ReturnType<typeof loadOfficialResults>["generalOfficial"]} officialGen
 * @param {boolean} hasOfficialData
 */
function getGeneralesPredListOpts(currentParticipantId, officialGen, hasOfficialData) {
  return {
    currentId: currentParticipantId ?? null,
    hasSubmission: participantHasGeneralSubmission,
    scoringActive: hasOfficialData,
    previewSeed: "generales",
    getPoints: (p) =>
      computeGeneralPredictionsScore(loadPredictions(p.id).general ?? {}, officialGen, hasOfficialData).total,
  };
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

  const generalesListOpts = getGeneralesPredListOpts(currentParticipantId, officialGen, hasOfficialData);

  const participantScores = getParticipantsForListDisplay(
    currentParticipantId,
    getParticipantSearchQuery(),
    generalesListOpts,
  ).map((p) => {
    const gen = loadPredictions(p.id).general ?? {};
    const score = computeGeneralPredictionsScore(gen, officialGen, hasOfficialData);
    return { p, gen, score };
  });
  const maxPts = Math.max(0, ...participantScores.map((x) => x.score.total));

  const participantRows = participantScores.map(({ p, gen, score }) => {
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
    </div>
    ${buildGeneralesVoteStatsHtml()}`;
}

/**
 * Móvil: columnas de la tabla «Predicciones de todos» según el contenido (nombres largos).
 * @param {ParentNode | null | undefined} host
 */
function syncGeneralesPredsTableMobileColumns(host) {
  const table = host?.querySelector?.(".table-generales-preds");
  if (!table) return;

  let colgroup = table.querySelector("colgroup[data-generales-preds-cols]");
  if (!colgroup) {
    colgroup = document.createElement("colgroup");
    colgroup.dataset.generalesPredsCols = "1";
    for (let i = 0; i < 8; i++) {
      colgroup.appendChild(document.createElement("col"));
    }
    table.insertBefore(colgroup, table.firstChild);
  }

  const cols = [...colgroup.querySelectorAll("col")];

  if (!isMobileLayout()) {
    table.style.removeProperty("width");
    table.style.removeProperty("min-width");
    cols.forEach((col) => {
      col.style.removeProperty("min-width");
      col.style.removeProperty("width");
    });
    return;
  }

  table.style.width = "max-content";
  table.style.minWidth = "100%";

  cols.forEach((col) => col.style.removeProperty("min-width"));
  void table.offsetWidth;

  for (let c = 0; c < cols.length; c++) {
    let maxW = 0;
    table
      .querySelectorAll(
        `:scope > thead > tr > :nth-child(${c + 1}), :scope > tbody > tr > :nth-child(${c + 1})`,
      )
      .forEach((cell) => {
        maxW = Math.max(maxW, cell.scrollWidth);
      });
    if (maxW > 0) {
      cols[c].style.minWidth = `${Math.ceil(maxW)}px`;
    }
  }
}

/**
 * @param {string} participantId
 */
function renderGeneralesComparisonTable(participantId) {
  const host = $("#generales-preds-host");
  if (!host) return;
  host.innerHTML = buildGeneralesPredictionsTableHtml(participantId);
  const officialStore = loadOfficialResults();
  const officialGen = officialStore.generalOfficial ?? {};
  const hasOfficialData =
    officialStore.generalOfficialConfirmed === true &&
    Boolean(String(officialGen.first ?? "").trim()) &&
    Boolean(String(officialGen.second ?? "").trim()) &&
    Boolean(String(officialGen.third ?? "").trim());
  const generalesBar = document.querySelector("#panel-generales [data-participant-search-bar]");
  if (generalesBar instanceof HTMLElement) {
    stampArenaPredictionListMeta(
      generalesBar,
      getGeneralesPredListOpts(participantId, officialGen, hasOfficialData),
    );
  }
  requestAnimationFrame(() => {
    syncGeneralesPredsTableMobileColumns(host);
    syncGroupPtsBadgeCanvases(host);
  });
  syncArenaTruncationHints();
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
        ${generalesFullFormInnerHtml(g, adminOfficialFormDisabled)}
      </form>
    </article>`;

  const form = $("#form-generales-official");
  if (!form) return;

  for (const key of ["first", "second", "third", "bestPlayer", "bestGk", "topScorer"]) {
    const el = form.querySelector(`[name="${key}"]`);
    if (el) el.value = String(g[key] ?? "");
  }
  syncGeneralesPickerValues(form, g);

  function commitOfficialDraft() {
    saveOfficialResults({
      generalOfficial: readGeneralFormPayload(form),
      generalOfficialConfirmed: false,
    });
    renderGeneralesComparisonTable(participantId);
    renderStats(loadSession());
  }

  if (!adminOfficialFormDisabled) {
    wireGeneralesAwardComboboxes(form, commitOfficialDraft);
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
    if (t instanceof Element && t.closest("[data-partidos-goto-rules-cercania]")) {
      e.preventDefault();
      close();
      tabsController?.setTab("reglas");
      window.setTimeout(() => {
        document.getElementById("reglas-cercania")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const lockBanner = officialLocked
    ? `<p class="generales-locked-banner muted" role="status">El resultado oficial está <strong>confirmado</strong>. No puedes cambiar tus predicciones hasta que un administrador desconfirme.</p>`
    : generalesPredictionsAdminBlocked()
      ? isAdmin
        ? `<p class="generales-locked-banner generales-locked-banner--admin muted" role="status">Tus predicciones de participante están <strong>bloqueadas</strong> mientras defines el resultado oficial. Usa el panel <strong>Resultado oficial (admin)</strong> más abajo.</p>`
        : `<p class="generales-locked-banner muted" role="status">Un administrador ha <strong>bloqueado</strong> esta pestaña: no puedes cambiar el podio ni los premios individuales hasta que lo desbloqueen.</p>`
      : isAnyTournamentMatchKickoffLocked()
        ? isArenaMode()
          ? `<p class="generales-locked-banner muted" role="status">Las predicciones generales están <strong>cerradas</strong> desde el ${escapeHtml(arenaGeneralesGroupsDeadlineDateLabelSpanish())} (hora CDMX).</p>`
          : `<p class="generales-locked-banner muted" role="status">Las predicciones generales están <strong>cerradas</strong>: ya comenzó al menos un partido del torneo.</p>`
        : "";

  const countdownBanner = arenaDeadlineCountdownOpen() ? arenaDeadlineCountdownBannerHtml() : "";
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
  form.innerHTML = `${arenaPrivadasReadOnlyBannerHtml()}${countdownBanner}${lockBanner}
    ${generalesFullFormInnerHtml(g, formDisabled)}
    ${userConfirmActionsHtml}`;

  if (countdownBanner) scheduleArenaDeadlineCountdownInterval();

  for (const key of ["first", "second", "third", "bestPlayer", "bestGk", "topScorer"]) {
    const el = form.querySelector(`[name="${key}"]`);
    if (el) el.value = g[key] ?? "";
  }
  syncGeneralesPickerValues(form, g);

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
    wireGeneralesAwardComboboxes(form, commitUserGenerales);

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

let groupOrderPickerDocClickWired = false;

/** @param {HTMLSelectElement} sel */
function syncGroupOrderPickerTrigger(sel) {
  const wrap = sel.closest(".group-order-combobox");
  const trigger = wrap?.querySelector(".group-order-combobox__trigger");
  if (!trigger) return;
  const opt = sel.selectedOptions[0];
  trigger.textContent = opt?.textContent ?? "— Elegir equipo —";
}

/** @param {HTMLElement} scope */
function syncAllGroupOrderPickers(scope) {
  scope.querySelectorAll('select[data-role="order"]').forEach((sel) => {
    if (sel instanceof HTMLSelectElement) syncGroupOrderPickerTrigger(sel);
  });
}

/** @param {HTMLOListElement} ol */
function wireGroupOrderMobilePickers(ol) {
  if (!isMobileLayout()) return;

  function closeAllGroupOrderPickerLists(except) {
    ol.querySelectorAll(".group-order-combobox__list").forEach((list) => {
      const box = list.closest(".group-order-combobox");
      if (except && box === except) return;
      list.hidden = true;
      const trigger = box?.querySelector(".group-order-combobox__trigger");
      trigger?.setAttribute("aria-expanded", "false");
    });
  }

  ol.querySelectorAll('select[data-role="order"]').forEach((sel) => {
    if (!(sel instanceof HTMLSelectElement) || sel.dataset.mobilePickerWired === "1") return;
    sel.dataset.mobilePickerWired = "1";

    const wrap = document.createElement("div");
    wrap.className = "group-order-combobox";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "group-order-combobox__trigger input input-sm";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const list = document.createElement("ul");
    list.className = "group-order-combobox__list";
    list.setAttribute("role", "listbox");
    list.hidden = true;

    Array.from(sel.options).forEach((opt) => {
      const li = document.createElement("li");
      li.className = "group-order-combobox__option";
      li.setAttribute("role", "option");
      li.dataset.value = opt.value;
      li.textContent = opt.textContent;
      list.appendChild(li);
    });

    const parent = sel.parentNode;
    if (!parent) return;
    parent.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    wrap.appendChild(trigger);
    wrap.appendChild(list);
    sel.classList.add("group-order-combobox__native");

    syncGroupOrderPickerTrigger(sel);

    trigger.addEventListener("click", () => {
      const willOpen = list.hidden;
      closeAllGroupOrderPickerLists(willOpen ? wrap : null);
      list.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen && isArenaMode()) bumpArenaInteraction(12000);
    });

    list.addEventListener("click", (e) => {
      const li = e.target.closest(".group-order-combobox__option");
      if (!li) return;
      sel.value = li.dataset.value ?? "";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      syncGroupOrderPickerTrigger(sel);
      list.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    });
  });

  if (!groupOrderPickerDocClickWired) {
    groupOrderPickerDocClickWired = true;
    document.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.closest(".group-order-combobox")) return;
      document.querySelectorAll(".group-order-combobox__list").forEach((list) => {
        list.hidden = true;
      });
      document.querySelectorAll(".group-order-combobox__trigger").forEach((trigger) => {
        trigger.setAttribute("aria-expanded", "false");
      });
    });
  }
}

function renderGrupos(participantId, predictions) {
  syncArenaGruposPanelCountdown();
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

    const orderKickoffLocked = isAnyTournamentMatchKickoffLocked();
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
        <p class="group-admin-lock__title">Bloqueo global del orden de grupos</p>
        <div class="group-admin-lock__actions">
          ${
            groupsBlocked
              ? `<button type="button" class="btn btn-sm" data-group-admin-lock="off">Desbloquear para todos</button>`
              : `<button type="button" class="btn btn-sm" data-group-admin-lock="on">Bloquear para todos</button>`
          }
        </div>
        <p class="muted group-admin-lock__status">${
          groupsBlocked
            ? "Actualmente bloqueado: nadie puede editar el orden de clasificación ni si el 3.º pasa."
            : "Actualmente desbloqueado: todos pueden editar el orden de sus grupos."
        }</p>
      `;
      card.appendChild(adminLock);
    } else if (groupsBlocked) {
      const blocked = document.createElement("p");
      blocked.className = "generales-locked-banner muted";
      blocked.setAttribute("role", "status");
      blocked.innerHTML =
        "Un administrador ha <strong>bloqueado</strong> el orden de grupos: no puedes cambiar la clasificación ni si el 3.º pasa hasta que lo desbloquee.";
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
        orderWrap.innerHTML += isArenaMode()
          ? `<p class="muted">Cerrado desde el ${escapeHtml(arenaGeneralesGroupsDeadlineDateLabelSpanish())} (hora CDMX).</p>`
          : `<p class="muted">Cerrado: ya comenzó al menos un partido del torneo.</p>`;
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
          syncAllGroupOrderPickers(ol);
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
      wireGroupOrderMobilePickers(ol);
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
    predsHost.dataset.groupId = grp.id;
    predsHost.innerHTML = buildGroupPredictionsTableHtml(grp, participantId);
    stampGroupPredListMeta(predsHost, grp, participantId);
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
        ? "¿Bloquear el orden de clasificación de grupos para todos (incluido Tivo)? Los marcadores de partidos no se ven afectados."
        : "¿Desbloquear el orden de clasificación de grupos para todos?";
      if (!confirm(q)) return;
      saveOfficialResults({ groupPredictionsBlockedForAll: to });
      refreshAll(loadSession());
    });
  });

  syncThirdLimitRibbon(predictions);
  syncParticipantSearchInputs();
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
      const closestEligible = getClosestScoreBonusIdsForMatch(m.id, off, isKo).has(p.id);
      const matchScoring = getMatchScoringForQuiniela(m);
      const pts = computeGroupMatchPoints(off, pred, improb, matchScoring, koPenPh, closestEligible);
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
  if (isArenaMode()) {
    const serverRows = mapArenaServerRankingRows(currentParticipantId);
    if (serverRows) return serverRows;
  }
  return computeLiveParticipantRowsFromData(
    getParticipantsForDisplay(),
    getAllPredictionsMap(),
    loadOfficialResults(),
    currentParticipantId,
    { arenaScoring: true },
  );
}

/** Rankings/stats globales: solo paneles visibles + ranking flotante. */
function runGlobalRankingsRefresh(session) {
  if (!session) return;
  renderFloatingRanking(session);
  const tab = getActiveTabId();
  if (tab === "stats") renderStats(session);
  if (tab === "match-ranking") redrawMatchRanking();
  if (tab === "match-history") redrawMatchHistory();
  if (tab === "final-ranking") renderFinalRanking(session);
  if (tab === "team-stats") redrawTeamStats();
}

function flushDeferredGlobalRankingsRefresh() {
  if (deferredGlobalRankingsTimer == null) return;
  clearTimeout(deferredGlobalRankingsTimer);
  deferredGlobalRankingsTimer = null;
  runGlobalRankingsRefresh(loadSession());
}

/** @param {{ participantId: string } | null} [session] */
function scheduleDeferredGlobalRankingsRefresh(session) {
  if (deferredGlobalRankingsTimer != null) clearTimeout(deferredGlobalRankingsTimer);
  deferredGlobalRankingsTimer = window.setTimeout(() => {
    deferredGlobalRankingsTimer = null;
    runGlobalRankingsRefresh(session ?? loadSession());
  }, DEFERRED_GLOBAL_RANKINGS_MS);
}

function renderFloatingRanking(session) {
  const host = $("#floating-ranking");
  const body = $("#floating-ranking-body");
  if (!host || !body) return;
  const currentId = session?.participantId ?? "";
  const sortedRows = sortRankingRows(getLiveRankingRows(currentId));
  const rows = orderRankingRowsForDisplay(sortedRows, currentId);

  body.innerHTML = `<table class="floating-ranking-table" aria-label="Ranking en vivo">
    <thead><tr>
      <th scope="col" class="floating-ranking-th-num">#</th>
      <th scope="col" class="floating-ranking-th-player">Jugador</th>
      <th scope="col" class="floating-ranking-th-stat" title="Bono más cerca del marcador en partidos">Cerc.</th>
      <th scope="col" class="floating-ranking-th-pts">Pts</th>
    </tr></thead>
    <tbody>
      ${rows
        .map((r) => {
          const podium =
            r.displayRank === 1
              ? "floating-ranking-row--gold"
              : r.displayRank === 2
                ? "floating-ranking-row--silver"
                : r.displayRank === 3
                  ? "floating-ranking-row--bronze"
                  : "";
          const rowClass = [podium, r.self ? "floating-ranking-row-self" : ""].filter(Boolean).join(" ");
          const you = r.self ? " (tu)" : "";
          const cerc = r.totalClosest ?? 0;
          return `<tr class="${rowClass}"><td>${r.displayRank}</td><th scope="row">${escapeHtml(r.p.name)}${you}</th><td class="floating-ranking-th-stat">${cerc}</td><td><strong>${r.pts}</strong></td></tr>`;
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
    const state = enabled ? "ON" : "OFF";
    if (isMobileLayout()) {
      enableBtn.textContent = `🏆 ${state}`;
      enableBtn.title = `Ranking flotante: ${state}`;
      enableBtn.setAttribute("aria-label", `Ranking flotante: ${state}`);
    } else {
      enableBtn.textContent = `Ranking flotante: ${state}`;
      enableBtn.title = "";
      enableBtn.setAttribute("aria-label", `Ranking flotante: ${state}`);
    }
  }

  MOBILE_LAYOUT_MQ?.addEventListener("change", updateEnableButton);

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

  function ensureHostDragCoords() {
    const rect = host.getBoundingClientRect();
    applyHostPosPx(rect.left, rect.top);
    return rect;
  }

  function finishDragPointer(e) {
    if (dragSmooth.pointerId !== e.pointerId) return;
    stopDragRaf();
    window.removeEventListener("pointermove", onDragPointerMove);
    window.removeEventListener("pointerup", finishDragPointer);
    window.removeEventListener("pointercancel", cancelDragPointer);
    if (toggle.hasPointerCapture?.(e.pointerId)) {
      toggle.releasePointerCapture(e.pointerId);
    }
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
  }

  function cancelDragPointer(e) {
    if (dragSmooth.pointerId !== e.pointerId) return;
    stopDragRaf();
    window.removeEventListener("pointermove", onDragPointerMove);
    window.removeEventListener("pointerup", finishDragPointer);
    window.removeEventListener("pointercancel", cancelDragPointer);
    if (toggle.hasPointerCapture?.(e.pointerId)) {
      toggle.releasePointerCapture(e.pointerId);
    }
    host.classList.remove("is-dragging", "floating-ranking--pressing");
    dragSmooth.pointerId = -1;
  }

  function onDragPointerMove(e) {
    if (dragSmooth.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragSmooth.originClientX;
    const dy = e.clientY - dragSmooth.originClientY;
    if (!dragSmooth.moved && Math.hypot(dx, dy) > 6) {
      dragSmooth.moved = true;
      host.classList.remove("floating-ranking--pressing");
      host.classList.add("is-dragging");
    }
    if (!dragSmooth.moved) return;
    e.preventDefault();

    const rawX = dragSmooth.originHostLeft + (e.clientX - dragSmooth.originClientX);
    const rawY = dragSmooth.originHostTop + (e.clientY - dragSmooth.originClientY);
    const p = clampHostPos(rawX, rawY);
    dragSmooth.targetX = p.x;
    dragSmooth.targetY = p.y;
    scheduleDragRaf();
  }

  toggle.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      dragSmooth.pointerId = e.pointerId;
      dragSmooth.moved = false;
      stopDragRaf();
      const rect = ensureHostDragCoords();
      dragSmooth.originClientX = e.clientX;
      dragSmooth.originClientY = e.clientY;
      dragSmooth.originHostLeft = rect.left;
      dragSmooth.originHostTop = rect.top;
      dragSmooth.currentX = dragSmooth.targetX = rect.left;
      dragSmooth.currentY = dragSmooth.targetY = rect.top;
      if (toggle.setPointerCapture) {
        try {
          toggle.setPointerCapture(e.pointerId);
        } catch {
          /* algunos navegadores móviles no soportan captura en este botón */
        }
      }
      window.addEventListener("pointermove", onDragPointerMove, { passive: false });
      window.addEventListener("pointerup", finishDragPointer);
      window.addEventListener("pointercancel", cancelDragPointer);
      host.classList.add("floating-ranking--pressing");
    },
    { passive: false },
  );

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
  const sortedRows = sortRankingRows(getLiveRankingRows(session.participantId));
  const rows = orderRankingRowsForDisplay(sortedRows, session.participantId);
  const maxBonus = Math.max(0, ...sortedRows.map((r) => r.totalBonus));
  const maxClosest = Math.max(0, ...sortedRows.map((r) => r.totalClosest ?? 0));
  const maxPerfect = Math.max(0, ...sortedRows.map((r) => r.totalPerfect));
  const maxBien = Math.max(0, ...sortedRows.map((r) => r.totalBien));
  const maxExcelente = Math.max(0, ...sortedRows.map((r) => r.totalExcelente));
  const maxPts = Math.max(0, ...sortedRows.map((r) => r.pts));
  body.innerHTML = rows
    .map((r) => {
      const podium =
        r.displayRank === 1
          ? "group-ranking-row--gold"
          : r.displayRank === 2
            ? "group-ranking-row--silver"
            : r.displayRank === 3
              ? "group-ranking-row--bronze"
              : "";
      const rowCls = [podium, r.self ? "row-self" : ""].filter(Boolean).join(" ");
      const you = r.self ? ' <span class="td-muted">(tú)</span>' : "";
      return `<tr class="${rowCls}">
        <td class="group-ranking-rank">${r.displayRank}</td>
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
          "BONUS totales (improbable en partidos y minoría en orden de grupos).",
          maxBonus > 0 && r.totalBonus === maxBonus,
          "bonus",
        )}
        ${groupOrderRankingStatCell(
          r.totalClosest ?? 0,
          "CERCANÍA: bono «más cerca del marcador» en partidos (+1 c/u).",
          maxClosest > 0 && (r.totalClosest ?? 0) === maxClosest,
          "cercania",
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

  const rows = getLiveRankingRows(session.participantId);
  const byPoints = sortRankingRows(rows);
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

  const acDisplay = orderRankingRowsForDisplay(byPoints, session.participantId);

  if (!acHead || !acBody) return;

  if (acDisplay.length === 0) {
    acHead.innerHTML = "";
    acBody.innerHTML = "";
    return;
  }

  const selfIdx = acDisplay.findIndex((r) => r.self);
  const hintRow =
    showStatsColorHint && selfIdx >= 0
      ? `<tr class="stats-color-hint-row" aria-hidden="true">` +
        `<th class="stats-color-hint-cell stats-color-hint-cell--empty"></th>` +
        acDisplay
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
    acDisplay
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
      const rawVals = acDisplay.map((r) => m.value(r));
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
        acDisplay
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
 * @param {{ kickoff?: string | null, id: string }} m
 * @param {Set<string>} nextJornadaIds
 * @param {boolean} matchInProgress
 * @param {boolean} [shortLabel] SIGUIENTE en móvil vs SIGUIENTE PARTIDO en escritorio
 */
function partidosCornerBadgeHtml(m, nextJornadaIds, matchInProgress, shortLabel = false) {
  if (!m.kickoff) return "";
  const isJornadaProxima = nextJornadaIds.has(m.id);
  if (matchInProgress) {
    return `<span class="partidos-corner-badge partidos-corner-badge--en-juego" role="status">EN JUEGO</span>`;
  }
  if (isJornadaProxima) {
    const label = shortLabel ? "SIGUIENTE" : "SIGUIENTE PARTIDO";
    return `<span class="partidos-corner-badge" role="status">${escapeHtml(label)}</span>`;
  }
  return "";
}

/**
 * Chip compacto de predicción (solo resumen móvil).
 * @param {boolean} confirmed
 * @param {boolean} [matchOfficiallyClosed]
 */
function partidosUserPredChipHtml(confirmed, matchOfficiallyClosed = false) {
  if (matchOfficiallyClosed) {
    return `<span class="partidos-acc__pred-chip partidos-acc__pred-chip--ended" role="status">Terminado</span>`;
  }
  const tone = confirmed ? "partidos-acc__pred-chip--ok" : "partidos-acc__pred-chip--warn";
  const label = confirmed ? "Confirmada" : "Sin confirmar";
  return `<span class="partidos-acc__pred-chip ${tone}" role="status">${escapeHtml(label)}</span>`;
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
  const dateS = formatKickoffShortSpanish(m.kickoff);
  const eta = countdownLabelSpanish(m.kickoff);
  const meta = `<div class="partidos-match-corner__meta">
    <div class="partidos-match-corner__date-line">${escapeHtml(dateS)}</div>
    <div class="partidos-match-corner__eta">${escapeHtml(eta)}</div>
  </div>`;
  const badge = partidosCornerBadgeHtml(m, nextJornadaIds, matchInProgress);
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

/** Marcador centrado con celdas resaltadas (solo resumen móvil, partido cerrado). */
function partidosAccMobileClosedScoreHtml(home, away) {
  if (home === "" || away === "") return "";
  const homeCls = officialScoreOutcomeClass(home, away, "home");
  const awayCls = officialScoreOutcomeClass(home, away, "away");
  const hs = escapeHtml(String(home));
  const as = escapeHtml(String(away));
  return `<div class="partidos-acc__mobile-score" role="status" aria-label="Resultado ${hs} a ${as}">
    <span class="quiniela-cell quiniela-cell--score partidos-acc__mobile-score-cell${homeCls}">${hs}</span>
    <span class="partidos-acc__mobile-score-sep" aria-hidden="true">—</span>
    <span class="quiniela-cell quiniela-cell--score partidos-acc__mobile-score-cell${awayCls}">${as}</span>
  </div>`;
}

/**
 * Resumen compacto del acordeón (visible solo en móvil vía CSS).
 * @param {{
 *   contextLabel: string,
 *   homeTeamsHtml: string,
 *   awayTeamsHtml: string,
 *   m: { kickoff?: string | null, id: string },
 *   nextJornadaIds: Set<string>,
 *   matchInProgress: boolean,
 *   userPredConfirmed: boolean,
 *   matchOfficiallyClosed: boolean,
 *   closedHomeScore?: string | number,
 *   closedAwayScore?: string | number,
 * }} opts
 */
function partidosAccSummaryMobileHtml(opts) {
  const {
    contextLabel,
    homeTeamsHtml,
    awayTeamsHtml,
    m,
    nextJornadaIds,
    matchInProgress,
    userPredConfirmed,
    matchOfficiallyClosed,
    closedHomeScore = "",
    closedAwayScore = "",
  } = opts;
  const badge = partidosCornerBadgeHtml(m, nextJornadaIds, matchInProgress, true);
  const predChip = partidosUserPredChipHtml(userPredConfirmed, matchOfficiallyClosed);
  if (matchOfficiallyClosed) {
    const closedScoreHtml = partidosAccMobileClosedScoreHtml(closedHomeScore, closedAwayScore);
    return `<div class="partidos-acc__summary-mobile partidos-acc__summary-mobile--closed">
    <div class="partidos-acc__mobile-head">
      <span class="partidos-acc__context">${escapeHtml(contextLabel)}</span>
      <span class="partidos-acc__pred-chip partidos-acc__pred-chip--ended" role="status">Terminado</span>
    </div>
    <div class="partidos-acc__mobile-teams">
      <span class="partidos-acc__team partidos-acc__team--home">${homeTeamsHtml}</span>
      <span class="vs">vs</span>
      <span class="partidos-acc__team partidos-acc__team--away">${awayTeamsHtml}</span>
    </div>
    ${closedScoreHtml}
  </div>`;
  }
  let metaBlock = "";
  {
    let leftMeta = "";
    if (m.kickoff && !matchInProgress) {
      const eta = countdownLabelSpanish(m.kickoff);
      if (eta) {
        leftMeta = `<span class="partidos-acc__eta muted">${escapeHtml(eta)}</span>`;
      }
    } else if (!m.kickoff) {
      leftMeta = `<span class="partidos-acc__no-kick-inline muted">Sin fecha de inicio</span>`;
    }
    metaBlock = `<div class="partidos-acc__mobile-meta">
      <div class="partidos-acc__mobile-status">
        ${leftMeta ? `<span class="partidos-acc__mobile-eta-wrap">${leftMeta}</span>` : ""}
        <span class="partidos-acc__mobile-pred">${predChip}</span>
      </div>
    </div>`;
  }
  return `<div class="partidos-acc__summary-mobile">
    <div class="partidos-acc__mobile-head">
      <span class="partidos-acc__context">${escapeHtml(contextLabel)}</span>
      ${badge}
    </div>
    <div class="partidos-acc__mobile-teams">
      <span class="partidos-acc__team partidos-acc__team--home">${homeTeamsHtml}</span>
      <span class="vs">vs</span>
      <span class="partidos-acc__team partidos-acc__team--away">${awayTeamsHtml}</span>
    </div>
    ${metaBlock}
  </div>`;
}

/**
 * Resumen del acordeón en escritorio (visible solo en PC vía CSS).
 * @param {{
 *   contextLabel: string,
 *   homeTeamsHtml: string,
 *   awayTeamsHtml: string,
 *   accessibleTitle: string,
 *   matchOfficiallyClosed: boolean,
 *   closedHomeScore?: string | number,
 *   closedAwayScore?: string | number,
 *   noKickHtml?: string,
 *   predInlineHtml?: string,
 *   officialPreview?: string,
 * }} opts
 */
function partidosAccSummaryDesktopHtml(opts) {
  const {
    contextLabel,
    homeTeamsHtml,
    awayTeamsHtml,
    accessibleTitle,
    matchOfficiallyClosed,
    closedHomeScore = "",
    closedAwayScore = "",
    noKickHtml = "",
    predInlineHtml = "",
    officialPreview = "",
  } = opts;
  const closedScoreInner = matchOfficiallyClosed
    ? partidosAccMobileClosedScoreHtml(closedHomeScore, closedAwayScore)
    : "";
  const scoreHtml = closedScoreInner
    ? `<div class="partidos-acc__desktop-result"><span class="partidos-acc__desktop-result-label">Resultado:</span>${closedScoreInner}</div>`
    : "";
  const officialPreviewHtml =
    !matchOfficiallyClosed && officialPreview
      ? `<div class="partidos-acc__official-preview">${officialPreview}</div>`
      : "";
  const closedCls = matchOfficiallyClosed ? " partidos-acc__summary-desktop--closed" : "";
  return `<div class="partidos-acc__summary-desktop${closedCls}">
    <h2 class="visually-hidden">${escapeHtml(accessibleTitle)}</h2>
    <span class="partidos-acc__context">${escapeHtml(contextLabel)}</span>
    <div class="partidos-acc__desktop-teams">
      <span class="partidos-acc__team partidos-acc__team--home">${homeTeamsHtml}</span>
      <span class="vs">vs</span>
      <span class="partidos-acc__team partidos-acc__team--away">${awayTeamsHtml}</span>
    </div>
    ${scoreHtml}
    ${noKickHtml}
    ${predInlineHtml}
    ${officialPreviewHtml}
  </div>`;
}

/** Fecha de inicio en el cuerpo del acordeón (visible solo en móvil vía CSS). */
function partidosAccKickoffBodyHtml(m) {
  if (!m.kickoff) return "";
  const dateS = formatKickoffShortSpanish(m.kickoff);
  return `<p class="partidos-acc__kickoff-date muted" role="note">${escapeHtml(dateS)}</p>`;
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
 * En juego arriba; luego jornada «SIGUIENTES»; después el resto. Dentro de cada bloque, por kickoff.
 * @param {Array<{ id: string, kickoff?: string | null, groupId?: string, roundId?: string }>} list
 * @param {Set<string>} nextJornadaIds
 * @param {ReturnType<typeof loadOfficialResults>} official
 */
function sortPartidosByLiveSiguientesKickoff(list, nextJornadaIds, official) {
  /** @param {{ id: string, kickoff?: string | null, groupId?: string, roundId?: string }} m */
  const sortTier = (m) => {
    if (isMatchLiveInPlay(official, m)) return 0;
    if (nextJornadaIds.has(m.id)) return 1;
    return 2;
  };
  return [...list].sort((a, b) => {
    const ta = sortTier(a);
    const tb = sortTier(b);
    if (ta !== tb) return ta - tb;
    const ka = a.kickoff ? Date.parse(a.kickoff) : Number.POSITIVE_INFINITY;
    const kb = b.kickoff ? Date.parse(b.kickoff) : Number.POSITIVE_INFINITY;
    if (ka !== kb) return ka - kb;
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
  const displayName = normalizeTeamName(teamName);
  const isTbd = isPlaceholderTeam(displayName);
  const cls = `team-label${isTbd ? " is-tbd" : ""}`;
  return `
    <span class="${cls}">
      ${getTeamFlagImgHtml(displayName)}
      <span class="team-text">${escapeHtml(displayName)}</span>
    </span>
  `;
}

function pointsBadgeHtml(points, options = {}) {
  const { bonus = false, closest = false, gold = false, title = "" } = options;
  if (!points || points <= 0) return "";
  /** @type {"green"|"bonus"|"silver"|"gold"} */
  let variant = "green";
  let modifier = "";
  if (bonus) {
    variant = "bonus";
    modifier = " group-preds-pt-badge--bonus";
  } else if (closest) {
    variant = "silver";
    modifier = " group-preds-pt-badge--silver";
  } else if (gold) {
    variant = "gold";
    modifier = " group-preds-pt-badge--gold";
  }
  const cls = `group-preds-pt-badge${modifier}`;
  const safeTitle = title ? ` title="${escapeHtml(title)}"` : "";
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

/** HTML del bono «más cerca» bajo el nombre del participante. */
function quinielaClosestBonusInlineHtml(breakdown) {
  const cp = breakdown?.closestPts ?? 0;
  if (cp <= 0) return "";
  return `<div class="quiniela-perfect-inline quiniela-closest-inline" role="status" aria-label="Más cerca del marcador"><span class="quiniela-closest-label">Más cerca</span>${pointsBadgeHtml(cp, {
    closest: true,
    title:
      "Bono más cerca del marcador (menor diferencia |Δ local|+|Δ visitante| entre quienes no acertaron perfecto; la mínima debe ser 1 o 2; solo si ese grupo es minoría, máx. 25 % de predicciones confirmadas)",
  })}</div>`;
}

/**
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
  if (rowClassString.includes("quiniela-pred-row--tier-perfect-bonus")) {
    return '<canvas class="quiniela-perfect-bonus-gradient-canvas" aria-hidden="true"></canvas>';
  }
  if (rowClassString.includes("quiniela-pred-row--tier-bien")) {
    return '<canvas class="quiniela-lead-tier-gradient-canvas" data-pm26-lead-tier="bien" aria-hidden="true"></canvas>';
  }
  if (rowClassString.includes("quiniela-pred-row--tier-badge")) {
    return '<canvas class="quiniela-lead-tier-gradient-canvas" data-pm26-lead-tier="badge" aria-hidden="true"></canvas>';
  }
  if (rowClassString.includes("quiniela-pred-row--tier-excelente")) {
    return '<canvas class="quiniela-lead-tier-gradient-canvas" data-pm26-lead-tier="excelente" aria-hidden="true"></canvas>';
  }
  if (
    rowClassString.includes("quiniela-pred-row--tier-perfect") &&
    !rowClassString.includes("quiniela-pred-row--tier-perfect-bonus")
  ) {
    return '<canvas class="quiniela-lead-tier-gradient-canvas" data-pm26-lead-tier="perfect" aria-hidden="true"></canvas>';
  }
  return "";
}

/**
 * Primera celda (participante). Canvas de gradiente animado en filas con tier (chroma-js).
 * @param {string} rowClassString clases del `<tr>` (p. ej. `quiniela-pred-row--lead quiniela-pred-row--tier-perfect-bonus`)
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
  const predictionsLocked = isGroupMatchPredictionsLocked(official, m);
  /** Tras iniciar el partido la última columna muestra Pts; antes solo acciones (confirmar/cambiar). */
  const showPtsColumn = matchStage !== "ready";

  const preliminary = getParticipantsForListDisplay(
    session.participantId,
    getParticipantSearchQuery(),
    getQuinielaMatchListOpts(m, session, official, false),
  ).map((p) => {
      const pStore = loadPredictions(p.id);
      const pred = pStore.groupScores[m.id] ?? { home: "", away: "" };
      const predCommitted = pStore.groupScoresConfirmed?.[m.id] === true;
      return { p, pred, predCommitted };
    });

  const improbableSign = officialCompleteForScoring ? getImprobableOutcomeSignForMatch(m.id, off) : null;
  const closestBonusIds = officialCompleteForScoring
    ? getClosestScoreBonusIdsForMatch(m.id, off, false)
    : new Set();

  const rows = sortQuinielaPredictionRows(
    preliminary.map((r) => {
      const closestEligible = closestBonusIds.has(r.p.id);
      const pts =
        officialCompleteForScoring && r.predCommitted
          ? computeGroupMatchPoints(off, r.pred, improbableSign, matchScoring, false, closestEligible)
          : null;
      const breakdown =
        officialCompleteForScoring && r.predCommitted
          ? computeGroupMatchPointsBreakdown(off, r.pred, improbableSign, matchScoring, false, closestEligible)
          : null;
      const exactTier = breakdown?.exactTier ?? null;
      const exact =
        breakdown && r.predCommitted ? isExactGroupPrediction(off, r.pred) : false;
      return { ...r, pts, breakdown, exact, exactTier };
    }),
    session.participantId,
  );

  const scoredPts = rows.filter(
    (d) => officialCompleteForScoring && d.predCommitted && d.pts !== null,
  );
  const maxPtsThisMatch = scoredPts.length ? Math.max(...scoredPts.map((d) => d.pts)) : 0;

  return rows
    .map((d) => {
      let cls = "quiniela-pred-row";
      if (d.p.id === session.participantId) cls += " quiniela-pred-row--self";
      if (matchPredictionSubmissionRank(d.pred, d.predCommitted) === 0) {
        cls += " quiniela-pred-row--empty-pred";
      }
      if (showPtsColumn) {
        cls += quinielaPredRowTierExtraClasses(d, {
          officialCompleteForScoring,
          comboApply: true,
        });
        cls += quinielaPredRowLeadExtraClasses(d, {
          officialCompleteForScoring,
          maxPtsThisMatch,
        });
      }

      const isSelf = d.p.id === session.participantId;
      const adminLateEdit = isAdminLateMatchPredictionEdit(session, predictionsLocked, d.predCommitted);
      const adminDeletePred = isAdminDeleteMatchPrediction(session, predictionsLocked, d.predCommitted, matchStage);
      const rowEditableByActor =
        (isSelf || canEditAll) &&
        !isArenaPrivadasMirrorUser() &&
        isMatchPredictionLockedForActor(adminLateEdit, d.predCommitted, predictionsLocked) === false &&
        !d.predCommitted &&
        teamsDecided;
      /** Borrador no confirmado: otros no ven marcador ni ganador hasta «Confirmar». */
      const hideDraftScoresFromOthers = !isSelf && !canEditAll && !d.predCommitted;
      const scoreCellPlain = (side) => {
        const v = side === "home" ? d.pred.home : d.pred.away;
        return v === "" ? "—" : escapeHtml(String(v));
      };

      let ph;
      let pa;
      if (isSelf || canEditAll) {
        if ((d.predCommitted || predictionsLocked) && !adminLateEdit) {
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
      tierExtra += quinielaClosestBonusInlineHtml(d.breakdown);
      const phCell = quinielaCellWithBadges(ph, homeBadge);
      const paCell = quinielaCellWithBadges(pa, awayBadge);
      const pcCell = quinielaPtsCellContentHtml(pcRaw, d, officialCompleteForScoring);
      const selfNote = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      const editableClass = rowEditableByActor ? " quiniela-pred-edit-row" : "";

      let lastColTd;
      if (showPtsColumn) {
        if (adminLateEdit) {
          const bothPred = d.pred.home !== "" && d.pred.away !== "";
          const confirmBtn = `<button type="button" class="btn btn-primary btn-sm quiniela-pred-confirm-user" data-mid="${escapeHtml(m.id)}" data-pid="${escapeHtml(d.p.id)}" ${bothPred ? "" : "disabled"}>Confirmar</button>`;
          lastColTd = `<td class="quiniela-num quiniela-last-col quiniela-pred-actions">${confirmBtn}</td>`;
        } else {
          const ptsTdCls = quinielaPtsTdClassList(d, {
            officialCompleteForScoring,
            maxPtsThisMatch,
          });
          const deleteBtn = adminDeletePred
            ? `<button type="button" class="btn btn-sm quiniela-pred-delete-user" data-mid="${escapeHtml(m.id)}" data-pid="${escapeHtml(d.p.id)}" data-pname="${escapeHtml(d.p.name)}">Borrar</button>`
            : "";
          const actionsWrap = deleteBtn
            ? `<div class="quiniela-pred-admin-actions">${deleteBtn}</div>`
            : "";
          lastColTd = `<td class="${ptsTdCls} quiniela-last-col"><div class="quiniela-last-col-stack">${pcCell}${actionsWrap}</div></td>`;
        }
      } else {
        let preplayInner = "";
        if (isSelf || canEditAll) {
          const bothPred = d.pred.home !== "" && d.pred.away !== "";
          if (predictionsLocked && !adminLateEdit) {
            const gameUnderway = matchStage !== "ready";
            const kickoffClosed = isLockedAtKickoff(m.kickoff);
            if (kickoffClosed && !gameUnderway) {
              preplayInner = '<span class="muted">Cerrado (hora de inicio)</span>';
            } else if (!gameUnderway) {
              preplayInner = '<span class="muted">Bloqueado</span>';
            }
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
 * Tier visual (color del badge) para cualquier fila con puntos durante el partido.
 * @param {{ predCommitted: boolean, pts: number|null, exact?: boolean, exactTier?: string|null, breakdown?: { improbablePts?: number, penaltyPts?: number } | null }} d
 * @param {{ officialCompleteForScoring: boolean, comboApply: boolean }} ctx
 * @returns {"bien"|"excelente"|"perfect"|"badge"|"perfect-bonus"|null}
 */
function quinielaPredRowTierKind(d, ctx) {
  const { officialCompleteForScoring, comboApply } = ctx;
  const hasScore =
    officialCompleteForScoring && d.predCommitted && d.pts !== null && typeof d.pts === "number";
  if (!hasScore || d.pts <= 0) return null;
  const imp = (d.breakdown?.improbablePts ?? 0) > 0;
  const exact = d.exact === true;
  if (exact && imp && d.exactTier !== "excelente") return "perfect-bonus";
  if (exact && d.exactTier === "excelente") return "excelente";
  if (exact) return "perfect";
  if ((d.breakdown?.penaltyPts ?? 0) > 0) return "bien";
  const combo = quinielaComboBadgeNoPointsTier(d.breakdown, { apply: comboApply });
  if (combo === "excelente") return "excelente";
  if (combo === "bien") return "bien";
  return "badge";
}

/**
 * Clase de tier (color) para todos los participantes con badge/puntos en juego.
 * @param {{ predCommitted: boolean, pts: number|null, exact?: boolean, exactTier?: string|null, breakdown?: { improbablePts?: number, penaltyPts?: number } | null }} d
 * @param {{ officialCompleteForScoring: boolean, comboApply: boolean }} ctx
 */
function quinielaPredRowTierExtraClasses(d, ctx) {
  const kind = quinielaPredRowTierKind(d, ctx);
  if (!kind) return "";
  return ` quiniela-pred-row--tier-${kind}`;
}

/**
 * Fila líder (máximo de puntos): solo tamaño ampliado; el color viene de `--tier-*`.
 * @param {{ predCommitted: boolean, pts: number|null }} d
 * @param {{ officialCompleteForScoring: boolean, maxPtsThisMatch: number }} ctx
 */
function quinielaPredRowLeadExtraClasses(d, ctx) {
  const { officialCompleteForScoring, maxPtsThisMatch } = ctx;
  const hasScore =
    officialCompleteForScoring && d.predCommitted && d.pts !== null && typeof d.pts === "number";
  if (!hasScore || maxPtsThisMatch <= 0 || d.pts !== maxPtsThisMatch) return "";
  return " quiniela-pred-row--lead";
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
  const predictionsLocked = isKoMatchPredictionsLocked(official, m);
  const showPtsColumn = koStage !== "ready";

  const { ri, mi } = getKoRoundMatchIndex(m.id);
  const labelScoresKo = allFilledOfficialKnockoutScores(official);
  const koOfficialHome = resolveKnockoutSlotLabel(ri, mi, "home", labelScoresKo);
  const koOfficialAway = resolveKnockoutSlotLabel(ri, mi, "away", labelScoresKo);
  const koOfficialSlotsDecided =
    isQuinielaTeamSlotDecided(koOfficialHome) && isQuinielaTeamSlotDecided(koOfficialAway);
  const koSlotsReadyForEdit = koOfficialSlotsDecided || canEditAll;
  const preliminary = getParticipantsForListDisplay(
    session.participantId,
    getParticipantSearchQuery(),
    getQuinielaMatchListOpts(m, session, official, true),
  ).map((p) => {
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
  const closestBonusIds = officialCompleteForScoring
    ? getClosestScoreBonusIdsForMatch(m.id, off, true)
    : new Set();

  const rows = sortQuinielaPredictionRows(
    preliminary.map((r) => {
      const closestEligible = closestBonusIds.has(r.p.id);
      const pts =
        officialCompleteForScoring && r.predCommitted
          ? computeGroupMatchPoints(off, r.pred, improbableSign, matchScoring, koPenaltyPhase, closestEligible)
          : null;
      const breakdown =
        officialCompleteForScoring && r.predCommitted
          ? computeGroupMatchPointsBreakdown(
              off,
              r.pred,
              improbableSign,
              matchScoring,
              koPenaltyPhase,
              closestEligible,
            )
          : null;
      const exactTier = breakdown?.exactTier ?? null;
      const exact =
        breakdown && r.predCommitted ? isExactGroupPrediction(off, r.pred) : false;
      return { ...r, pts, breakdown, exact, exactTier };
    }),
    session.participantId,
  );

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
      if (matchPredictionSubmissionRank(d.pred, d.predCommitted) === 0) {
        cls += " quiniela-pred-row--empty-pred";
      }
      if (showPtsColumn) {
        cls += quinielaPredRowTierExtraClasses(d, {
          officialCompleteForScoring,
          comboApply: !koOfficialDraw,
        });
        cls += quinielaPredRowLeadExtraClasses(d, {
          officialCompleteForScoring,
          maxPtsThisMatch: maxPtsThisMatchKo,
        });
      }

      const vm = d.virtualM;
      const isSelf = d.p.id === session.participantId;
      const adminLateEdit = isAdminLateMatchPredictionEdit(session, predictionsLocked, d.predCommitted);
      const adminDeletePred = isAdminDeleteMatchPrediction(session, predictionsLocked, d.predCommitted, koStage);
      const rowEditableByActor =
        (isSelf || canEditAll) &&
        !isArenaPrivadasMirrorUser() &&
        isMatchPredictionLockedForActor(adminLateEdit, d.predCommitted, predictionsLocked) === false &&
        !d.predCommitted &&
        koSlotsReadyForEdit;
      const hideDraftScoresFromOthers = !isSelf && !canEditAll && !d.predCommitted;
      const scoreCellPlain = (side) => {
        const v = side === "home" ? d.pred.home : d.pred.away;
        return v === "" ? "—" : escapeHtml(String(v));
      };

      let ph;
      let pa;
      if (isSelf || canEditAll) {
        if ((d.predCommitted || predictionsLocked) && !adminLateEdit) {
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
      tierExtra += quinielaClosestBonusInlineHtml(d.breakdown);
      const phCell = quinielaCellWithBadges(ph, homeBadge);
      const paCell = quinielaCellWithBadges(pa, awayBadge);
      const pcCell = quinielaPtsCellContentHtml(pcRaw, d, officialCompleteForScoring);
      const selfNote = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      const editableClass = rowEditableByActor ? " partidos-ko-pred-edit-row" : "";

      let lastColTd;
      if (showPtsColumn) {
        if (adminLateEdit) {
          const scoresOk = d.pred.home !== "" && d.pred.away !== "";
          const drawPred = predictionOutcomeSign(d.pred) === "d";
          const penOk =
            !koPenaltyPhase || !drawPred || d.pred.penaltyWinner === "home" || d.pred.penaltyWinner === "away";
          const bothPred = scoresOk && penOk;
          const confirmBtn = `<button type="button" class="btn btn-primary btn-sm partidos-ko-pred-confirm-user" data-kid="${escapeHtml(m.id)}" data-pid="${escapeHtml(d.p.id)}" ${bothPred ? "" : "disabled"}>Confirmar</button>`;
          lastColTd = `<td class="quiniela-num quiniela-last-col quiniela-pred-actions">${confirmBtn}</td>`;
        } else {
          const ptsTdCls = quinielaPtsTdClassList(d, {
            officialCompleteForScoring,
            maxPtsThisMatch: maxPtsThisMatchKo,
          });
          const deleteBtn = adminDeletePred
            ? `<button type="button" class="btn btn-sm partidos-ko-pred-delete-user" data-kid="${escapeHtml(m.id)}" data-pid="${escapeHtml(d.p.id)}" data-pname="${escapeHtml(d.p.name)}">Borrar</button>`
            : "";
          const actionsWrap = deleteBtn
            ? `<div class="quiniela-pred-admin-actions">${deleteBtn}</div>`
            : "";
          lastColTd = `<td class="${ptsTdCls} quiniela-last-col"><div class="quiniela-last-col-stack">${pcCell}${actionsWrap}</div></td>`;
        }
      } else {
        let preplayInner = "";
        if (isSelf || canEditAll) {
          const scoresOk = d.pred.home !== "" && d.pred.away !== "";
          const drawPred = predictionOutcomeSign(d.pred) === "d";
          const penOk =
            !koPenaltyPhase || !drawPred || d.pred.penaltyWinner === "home" || d.pred.penaltyWinner === "away";
          const bothPred = scoresOk && penOk;
          if (predictionsLocked && !adminLateEdit) {
            const gameUnderway = koStage !== "ready";
            const kickoffClosed = isLockedAtKickoff(m.kickoff);
            if (kickoffClosed && !gameUnderway) {
              preplayInner = '<span class="muted">Cerrado (hora de inicio)</span>';
            } else if (!gameUnderway) {
              preplayInner = '<span class="muted">Bloqueado</span>';
            }
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
function renderQuinielaMatchCardKo(m, session, official, isAdmin, nextJornadaIds, openAccordionMatchIds = null) {
  const accOpenAttr = openAccordionMatchIds?.has(m.id) ? " open" : "";
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
  const pStoreKo = loadPredictions(session.participantId);
  const userPredConfirmedKo = isUserPredictionConfirmedStore(pStoreKo, m);
  const matchClosedKo = isMatchOfficiallyClosed(official, m);
  const koInPlay = isMatchLiveInPlay(official, m);
  const cornerHtmlKo = partidosMatchCornerHtml(m, nextJornadaIds, userPredConfirmedKo, matchClosedKo, koInPlay);
  const noKickHtmlKo = partidosAccNoKickoffHintHtml(m);
  const officialPreviewKo = partidosOfficialPreviewLineKo(m, official, officialSlotsDecided);
  const predInlineKo = !m.kickoff
    ? `<div class="partidos-acc__pred-row">${partidosUserPredPillHtml(userPredConfirmedKo, "inline", matchClosedKo)}</div>`
    : "";
  const mobileSummaryKo = partidosAccSummaryMobileHtml({
    contextLabel: knockoutPhaseTitle(m.roundId),
    homeTeamsHtml: bracketTeamLineHtml(homeLab),
    awayTeamsHtml: bracketTeamLineHtml(awayLab),
    m,
    nextJornadaIds,
    matchInProgress: koInPlay,
    userPredConfirmed: userPredConfirmedKo,
    matchOfficiallyClosed: matchClosedKo,
    closedHomeScore: matchClosedKo ? off.home : "",
    closedAwayScore: matchClosedKo ? off.away : "",
  });
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
      : isLockedAtKickoff(m.kickoff)
        ? `<p class="quiniela-match-status quiniela-match-status--live" role="status"><strong>Cerrado por hora de inicio.</strong> Las predicciones ya no se pueden editar ni confirmar.</p>`
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

  const canManageMatchFlow = canManagePartidosMatchFlow(session.participantId);
  const officialMini = canManageMatchFlow
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
      <details class="partidos-acc"${accOpenAttr}>
        <summary class="partidos-acc__summary">
          <span class="partidos-acc__chev" aria-hidden="true"></span>
          <div class="partidos-acc__summary-main">
            ${mobileSummaryKo}
            ${partidosAccSummaryDesktopHtml({
              contextLabel: knockoutPhaseTitle(m.roundId),
              homeTeamsHtml: bracketTeamLineHtml(homeLab),
              awayTeamsHtml: bracketTeamLineHtml(awayLab),
              accessibleTitle: `${knockoutPhaseTitle(m.roundId)}: ${homeLab} vs ${awayLab}`,
              matchOfficiallyClosed: matchClosedKo,
              closedHomeScore: matchClosedKo ? off.home : "",
              closedAwayScore: matchClosedKo ? off.away : "",
              noKickHtml: noKickHtmlKo,
              predInlineHtml: predInlineKo,
              officialPreview: officialPreviewKo,
            })}
          </div>
        </summary>
        <div class="partidos-acc__body">
          ${partidosAccKickoffBodyHtml(m)}
          ${statusBanner}
          ${officialMini}
          <div class="quiniela-preds-head-row">
            <div class="quiniela-preds-head">Predicciones</div>
            ${participantSearchToolbarHtml({ ariaLabel: "Buscar jugador en este partido" })}
          </div>
          ${buildMatchVoteBarsHtml(homeLab, awayLab, m.id, true, m.roundId)}
          <div class="${quinielaPredsTableWrapClass()}">
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
              ${partidosPredsLazyTbodyHtml()}
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
 * @param {HTMLElement | null} [focusEl] input/stepper que disparó el guardado (el foco puede haberse movido ya)
 */
function patchQuinielaMatchPredRows(wrap, mid, focusEl) {
  const session = loadSession();
  if (!wrap || !session) return;
  const m = GROUP_MATCHES.find((x) => x.id === mid);
  if (!m) return;
  const card = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(mid)}"]`);
  if (!card) return;
  const tb = card.querySelector(".quiniela-preds tbody");
  if (!tb) return;
  if (tryLightPartidosSelfPredPatch(wrap, mid, false, focusEl)) return;
  if (tb.dataset.pm26PredsLazy === "1") {
    const det = card.querySelector("details.partidos-acc");
    if (!(det instanceof HTMLDetailsElement) || !det.open) {
      stampQuinielaCardPredictionMeta(card, m, session, loadOfficialResults(), false);
      return;
    }
    blurPartidosInteractionFocus(focusEl);
    const scrollY = isMobileLayout() ? window.scrollY : null;
    hydratePartidosMatchPredsTable(card, session);
    if (scrollY != null) window.scrollTo(0, scrollY);
    syncQuinielaTableHorizontalScroll(card);
    if (scrollY == null) restorePartidosPredRowsInteraction(wrap, mid, focusEl);
    return;
  }
  blurPartidosInteractionFocus(focusEl);
  const scrollY = isMobileLayout() ? window.scrollY : null;
  const isAdmin = canEditOfficialResults(session.participantId);
  const officialNow = loadOfficialResults();
  replacePartidosPredTbody(tb, buildQuinielaPredRowsHtml(m, session, officialNow, isAdmin), scrollY);
  stampQuinielaCardPredictionMeta(card, m, session, officialNow, false);
  wireQuinielaPredictionHandlersInScope(card, session);
  deferPartidosCardCanvasSync(card);
  syncQuinielaTableHorizontalScroll(card);
  if (scrollY == null) restorePartidosPredRowsInteraction(wrap, mid, focusEl);
}

/**
 * Igual que patchQuinielaMatchPredRows pero para cruces KO (`GROUP_MATCHES` no los incluye).
 * @param {HTMLElement | null} wrap
 * @param {string} kid
 * @param {HTMLElement | null} [focusEl]
 */
function patchQuinielaKoMatchPredRows(wrap, kid, focusEl) {
  const session = loadSession();
  if (!wrap || !session) return;
  const m = getKnockoutMatchesFlat().find((x) => x.id === kid);
  if (!m) return;
  const card = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(kid)}"]`);
  if (!card) return;
  const tb = card.querySelector(".quiniela-preds tbody");
  if (!tb) return;
  if (tryLightPartidosSelfPredPatch(wrap, kid, true, focusEl)) return;
  if (tb.dataset.pm26PredsLazy === "1") {
    const det = card.querySelector("details.partidos-acc");
    if (!(det instanceof HTMLDetailsElement) || !det.open) {
      stampQuinielaCardPredictionMeta(card, m, session, loadOfficialResults(), true);
      return;
    }
    blurPartidosInteractionFocus(focusEl);
    const scrollY = isMobileLayout() ? window.scrollY : null;
    hydratePartidosMatchPredsTable(card, session);
    if (scrollY != null) window.scrollTo(0, scrollY);
    syncQuinielaTableHorizontalScroll(card);
    if (scrollY == null) restorePartidosPredRowsInteraction(wrap, kid, focusEl);
    return;
  }
  blurPartidosInteractionFocus(focusEl);
  const scrollY = isMobileLayout() ? window.scrollY : null;
  const isAdmin = canEditOfficialResults(session.participantId);
  const officialNow = loadOfficialResults();
  replacePartidosPredTbody(tb, buildQuinielaPredRowsHtmlKo(m, session, officialNow, isAdmin), scrollY);
  stampQuinielaCardPredictionMeta(card, m, session, officialNow, true);
  wireQuinielaPredictionHandlersInScope(card, session);
  deferPartidosCardCanvasSync(card);
  syncQuinielaTableHorizontalScroll(card);
  if (scrollY == null) restorePartidosPredRowsInteraction(wrap, kid, focusEl);
}

/**
 * Solo tbody + resto de la app: no reemplaza #quiniela-wrap (evita scroll al 1.er partido con varios abiertos).
 * @param {{ participantId: string }} session
 * @param {string} matchId id de partido de grupos o KO
 * @param {HTMLElement | null} [focusEl]
 */
function refreshAfterParticipantPredictionScores(session, matchId, focusEl) {
  mutePartidosFullRenderAfterLocalEdit();
  const wrap = $("#quiniela-wrap");
  if (wrap && GROUP_MATCHES.some((x) => x.id === matchId)) {
    patchQuinielaMatchPredRows(wrap, matchId, focusEl);
  } else if (wrap) {
    patchQuinielaKoMatchPredRows(wrap, matchId, focusEl);
  }
  updatePredictionTabsProgress(session, loadPredictions(session.participantId));
  scheduleDeferredGlobalRankingsRefresh(session);
}

/**
 * Sustituye un solo `<article>` (p. ej. tras confirmar predicción: cambia pill del summary) y re-enlaza handlers.
 * @param {HTMLElement} wrap
 * @param {string} matchId
 * @param {{ participantId: string }} session
 * @param {HTMLElement | null} [focusEl]
 */
function replaceQuinielaMatchArticleAndRebind(wrap, matchId, session, focusEl = null) {
  const oldArt = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(matchId)}"]`);
  if (!(oldArt instanceof HTMLElement)) return;
  const anchor =
    capturePartidosInteractionAnchorFromElement(focusEl, wrap) ?? capturePartidosInteractionAnchor(wrap);
  const viewportLock =
    anchor?.articleMid === matchId
      ? (() => {
          const ae = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(matchId)}"]`);
          return ae ? { mid: matchId, vTop: ae.getBoundingClientRect().top } : null;
        })()
      : null;
  const official = loadOfficialResults();
  const isAdmin = canEditOfficialResults(session.participantId);
  const nextHighlightIds = getNextMatchDayHighlightIds(official, allMatchesForPartidosCalendar());
  const det = oldArt.querySelector("details.partidos-acc");
  const wasOpen = det instanceof HTMLDetailsElement && det.open;
  const openAccordionForCard = wasOpen ? new Set([matchId]) : null;
  const m = GROUP_MATCHES.find((x) => x.id === matchId);
  const html = m
    ? renderQuinielaMatchCard(m, session, official, isAdmin, nextHighlightIds, openAccordionForCard)
    : (() => {
        const mKo = getKnockoutMatchesFlat().find((x) => x.id === matchId);
        return mKo
          ? renderQuinielaMatchCardKo(mKo, session, official, isAdmin, nextHighlightIds, openAccordionForCard)
          : "";
      })();
  if (!html) return;
  oldArt.outerHTML = html;
  const newArt = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(matchId)}"]`);
  if (!(newArt instanceof HTMLElement)) return;
  if (wasOpen) {
    const d = newArt.querySelector("details.partidos-acc");
    if (d instanceof HTMLDetailsElement) d.open = true;
    scheduleHydratePartidosMatchPredsTable(newArt, session);
  }
  wireQuinielaPredictionHandlersInScope(newArt, session);
  if (m) stampQuinielaCardPredictionMeta(newArt, m, session, official, false);
  else {
    const mKo = getKnockoutMatchesFlat().find((x) => x.id === matchId);
    if (mKo) stampQuinielaCardPredictionMeta(newArt, mKo, session, official, true);
  }
  syncQuinielaPerfectBonusCanvases(wrap);
  syncGroupPtsBadgeCanvases(wrap);
  if (canManagePartidosMatchFlow(session.participantId)) bindPartidosAdminHandlers(newArt, session);
  if (anchor?.articleMid === matchId) restorePartidosInteractionAnchor(wrap, anchor, viewportLock);
}

/**
 * @param {HTMLElement} scope
 * @param {{ participantId: string }} session
 */
function bindPartidosAdminHandlers(scope, session) {
  const partidosWrap = $("#quiniela-wrap");
  if (!scope || !partidosWrap || !canManagePartidosMatchFlow(session.participantId)) return;
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
      confirmPendingPredictionsForGroupMatch(mid, { allowPartialDraft: true });
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".quiniela-official--editing").forEach((ed) => {
    wireOfficialGroupSteppers(
      ed,
      (partial, triggerEl) => {
        const mid = ed.dataset.quinielaMid;
        if (!mid || !partial[mid]) return;
        const offNow = loadOfficialResults();
        if ((offNow.groupMatchState?.[mid] ?? "ready") !== "started") return;
        saveOfficialResults({
          groupScores: { [mid]: { home: partial[mid].home, away: partial[mid].away } },
        });
        const termBtn = ed.querySelector(".quiniela-btn-terminar-partido");
        if (termBtn) {
          termBtn.disabled = partial[mid].home === "" || partial[mid].away === "";
        }
        const sess = loadSession();
        scheduleDeferredGlobalRankingsRefresh(sess);
        requestAnimationFrame(() => patchQuinielaMatchPredRows(partidosWrap, mid, triggerEl));
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
        groupScores: { [mid]: { home: "", away: "" } },
        groupScoresConfirmed: rest,
        replaceGroupScoresConfirmed: true,
        groupMatchState: { [mid]: "ready" },
      });
      refreshAll(loadSession());
    });
  });

  scope.querySelectorAll(".partidos-ko-official--editing").forEach((ed) => {
    wireOfficialKnockoutSteppers(ed, (partial, triggerEl) => {
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
      const sess = loadSession();
      scheduleDeferredGlobalRankingsRefresh(sess);
      if (sess && partidosWrap) {
        requestAnimationFrame(() => replaceQuinielaMatchArticleAndRebind(partidosWrap, kid, sess, triggerEl));
      }
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
      confirmPendingPredictionsForKoMatch(kid, { allowPartialDraft: true });
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
        knockoutScores: { [kid]: { home: "", away: "", penaltyWinner: "" } },
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
    wireScoreSteppers(row, "grupos", (partial, triggerEl) => {
      const mid = row.dataset.quinielaSelfMid;
      const targetParticipantId = row.dataset.predPid || session.participantId;
      if (!mid || !partial[mid] || !targetParticipantId) return;
      const gm = GROUP_MATCHES.find((x) => x.id === mid);
      if (!gm || isMatchPredictionSaveBlocked(session, loadOfficialResults(), gm, targetParticipantId, false)) return;
      savePredictions(targetParticipantId, {
        groupScores: { [mid]: { home: partial[mid].home, away: partial[mid].away } },
      });
      refreshAfterParticipantPredictionScores(loadSession(), mid, triggerEl);
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
      if (isMatchPredictionSaveBlocked(session, offNow, gm, targetParticipantId, false)) return;
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
      const gm = GROUP_MATCHES.find((x) => x.id === mid);
      if (!gm) return;
      const offNow = loadOfficialResults();
      if (isMatchPredictionSaveBlocked(session, offNow, gm, targetParticipantId, false)) return;
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
    wireScoreSteppers(row, "knockout", (partial, triggerEl) => {
      const kid = row.dataset.partidosKoSelfKid;
      const targetParticipantId = row.dataset.predPid || session.participantId;
      if (!kid || !partial[kid] || !targetParticipantId) return;
      const mKo = getKnockoutMatchesFlat().find((x) => x.id === kid);
      if (!mKo || isMatchPredictionSaveBlocked(session, loadOfficialResults(), mKo, targetParticipantId, true)) return;
      const latest = loadPredictions(targetParticipantId);
      const prevSc = latest.knockoutScores?.[kid] ?? {};
      const penPh = knockoutRoundRequiresPenaltyPickOnDraw(mKo.roundId);
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
      refreshAfterParticipantPredictionScores(loadSession(), kid, triggerEl);
    });
  });

  scope.querySelectorAll(".ko-user-pen-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kid = btn.dataset.kidPen;
      const targetParticipantId = btn.dataset.pid || session.participantId;
      const pick = btn.dataset.penPick;
      if (!kid || !targetParticipantId || (pick !== "home" && pick !== "away")) return;
      const mKo = getKnockoutMatchesFlat().find((x) => x.id === kid);
      if (!mKo || isMatchPredictionSaveBlocked(session, loadOfficialResults(), mKo, targetParticipantId, true)) return;
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
      const mKo = getKnockoutMatchesFlat().find((x) => x.id === kid);
      if (!mKo) return;
      const offPred = loadOfficialResults();
      if (offPred.knockoutScoresConfirmed?.[kid] === true) return;
      if (isMatchPredictionSaveBlocked(session, offPred, mKo, targetParticipantId, true)) return;
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
      const mKo = getKnockoutMatchesFlat().find((x) => x.id === kid);
      if (!mKo) return;
      const offNow = loadOfficialResults();
      if (offNow.knockoutScoresConfirmed?.[kid] === true) return;
      if (isMatchPredictionSaveBlocked(session, offNow, mKo, targetParticipantId, true)) return;
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

  scope.querySelectorAll(".quiniela-pred-delete-user").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mid = btn.dataset.mid;
      const targetParticipantId = btn.dataset.pid;
      const pname = btn.dataset.pname || targetParticipantId;
      if (!mid || !targetParticipantId) return;
      const gm = GROUP_MATCHES.find((x) => x.id === mid);
      if (!gm) return;
      const offNow = loadOfficialResults();
      const matchStage = offNow.groupMatchState?.[mid] ?? "ready";
      const predictionsLocked = isGroupMatchPredictionsLocked(offNow, gm);
      const pStore = loadPredictions(targetParticipantId);
      const predCommitted = pStore.groupScoresConfirmed?.[mid] === true;
      if (!isAdminDeleteMatchPrediction(session, predictionsLocked, predCommitted, matchStage)) return;
      if (!confirm(`¿Borrar la predicción de ${pname} en este partido?`)) return;
      await clearParticipantMatchPrediction(targetParticipantId, mid, false);
      const sess = loadSession();
      const wrap = $("#quiniela-wrap");
      if (wrap) replaceQuinielaMatchArticleAndRebind(wrap, mid, sess);
      refreshAll(sess, { skipPartidosRender: true });
    });
  });

  scope.querySelectorAll(".partidos-ko-pred-delete-user").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const kid = btn.dataset.kid;
      const targetParticipantId = btn.dataset.pid;
      const pname = btn.dataset.pname || targetParticipantId;
      if (!kid || !targetParticipantId) return;
      const mKo = getKnockoutMatchesFlat().find((x) => x.id === kid);
      if (!mKo) return;
      const offNow = loadOfficialResults();
      const matchStage = offNow.knockoutMatchState?.[kid] ?? "ready";
      const predictionsLocked = isKoMatchPredictionsLocked(offNow, mKo);
      const pStore = loadPredictions(targetParticipantId);
      const predCommitted = pStore.knockoutScoresConfirmed?.[kid] === true;
      if (!isAdminDeleteMatchPrediction(session, predictionsLocked, predCommitted, matchStage)) return;
      if (!confirm(`¿Borrar la predicción de ${pname} en este partido?`)) return;
      await clearParticipantMatchPrediction(targetParticipantId, kid, true);
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
  if (isArenaMode()) {
    selectedGroupMatches = selectedGroupMatches.filter(
      (m) => !ARENA_PRELAUNCH_EXCLUDED_GROUP_MATCH_IDS.has(m.id),
    );
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

  /** @type {Record<string, Set<string>>} */
  const groupClosestByMatch = {};
  for (const m of selectedGroupMatches) {
    const off = official.groupScores[m.id] ?? { home: "", away: "" };
    const stage = official.groupMatchState?.[m.id] ?? "ready";
    const officialConfirmed = stage === "finished" && official.groupScoresConfirmed?.[m.id] === true;
    const bothFilled = off.home !== "" && off.away !== "";
    const officialCompleteForScoring = bothFilled && (stage === "started" || officialConfirmed);
    groupClosestByMatch[m.id] = officialCompleteForScoring
      ? getClosestScoreBonusIdsForMatch(m.id, off, false)
      : new Set();
  }

  /** @type {Record<string, Set<string>>} */
  const koClosestByMatch = {};
  for (const m of selectedKoMatches) {
    const off = official.knockoutScores?.[m.id] ?? { home: "", away: "" };
    const officialConfirmed = official.knockoutScoresConfirmed?.[m.id] === true;
    const bothFilled = off.home !== "" && off.away !== "";
    const officialCompleteForScoring = bothFilled && officialConfirmed;
    koClosestByMatch[m.id] = officialCompleteForScoring
      ? getClosestScoreBonusIdsForMatch(m.id, off, true)
      : new Set();
  }

  const participantsForRanking = isArenaMode()
    ? getParticipantsForListDisplay(sessionParticipantId)
    : getParticipantsForDisplay();
  const rows = participantsForRanking.map((p) => {
    const pStore = loadPredictions(p.id);
    let bienCount = 0;
    let excelenteCount = 0;
    let perfectCount = 0;
    let bonusCount = 0;
    let closestCount = 0;
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
      const closestEligible = groupClosestByMatch[m.id]?.has(p.id) ?? false;
      const pts = computeGroupMatchPoints(off, pred, improbableSign, scoring, false, closestEligible);
      const breakdown = computeGroupMatchPointsBreakdown(
        off,
        pred,
        improbableSign,
        scoring,
        false,
        closestEligible,
      );
      if (pts != null) totalPoints += pts;
      if (breakdown?.exactTier === "perfecto") perfectCount += 1;
      else if (breakdown?.exactTier === "excelente") excelenteCount += 1;
      else if (breakdown?.exactTier === "bien") bienCount += 1;
      if (breakdown?.improbablePts && breakdown.improbablePts > 0) bonusCount += 1;
      if (breakdown?.closestPts && breakdown.closestPts > 0) closestCount += 1;
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
      const koPenPh = knockoutRoundRequiresPenaltyPickOnDraw(m.roundId);
      const improbableSign = koImprobableByMatch[m.id] ?? null;
      const closestEligible = koClosestByMatch[m.id]?.has(p.id) ?? false;
      const pts = computeGroupMatchPoints(off, pred, improbableSign, scoring, koPenPh, closestEligible);
      const breakdown = computeGroupMatchPointsBreakdown(
        off,
        pred,
        improbableSign,
        scoring,
        koPenPh,
        closestEligible,
      );
      if (pts != null) totalPoints += pts;
      if (breakdown?.exactTier === "perfecto") perfectCount += 1;
      else if (breakdown?.exactTier === "excelente") excelenteCount += 1;
      else if (breakdown?.exactTier === "bien") bienCount += 1;
      if (breakdown?.improbablePts && breakdown.improbablePts > 0) bonusCount += 1;
      if (breakdown?.closestPts && breakdown.closestPts > 0) closestCount += 1;
    }

    return { participant: p, bienCount, excelenteCount, perfectCount, bonusCount, closestCount, totalPoints };
  });

  rows.sort(compareRankingRows);

  const maxBien = Math.max(0, ...rows.map((r) => r.bienCount));
  const maxExcelente = Math.max(0, ...rows.map((r) => r.excelenteCount));
  const maxPerfect = Math.max(0, ...rows.map((r) => r.perfectCount));
  const maxBonus = Math.max(0, ...rows.map((r) => r.bonusCount));
  const maxClosest = Math.max(0, ...rows.map((r) => r.closestCount));
  const maxTotal = Math.max(0, ...rows.map((r) => r.totalPoints));
  const displayRows = orderRankingRowsForDisplay(rows, sessionParticipantId);

  return displayRows
    .map((r) => {
      const isSelf = r.participant.id === sessionParticipantId;
      const podium =
        r.displayRank === 1
          ? "group-ranking-row--gold"
          : r.displayRank === 2
            ? "group-ranking-row--silver"
            : r.displayRank === 3
              ? "group-ranking-row--bronze"
              : "";
      const rowCls = ["match-ranking-row", podium, isSelf ? "row-self" : ""].filter(Boolean).join(" ");
      const you = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      return `<tr class="${rowCls}">
        <td class="group-ranking-rank">${r.displayRank}</td>
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
          "BONUS improbable en partidos.",
          maxBonus > 0 && r.bonusCount === maxBonus,
          "bonus",
        )}
        ${groupOrderRankingStatCell(
          r.closestCount,
          "CERCANÍA: bono «más cerca del marcador» en partidos (+1 c/u).",
          maxClosest > 0 && r.closestCount === maxClosest,
          "cercania",
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

  /* Si ya está en vivo (incl. kickoff pasado), no mostrar contador de días. */
  if (isMatchLiveInPlay(official, m)) {
    return enJuegoHtml();
  }

  if (m.groupId != null) {
    const stage = official.groupMatchState?.[m.id] ?? "ready";
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
  const closestIds = getClosestScoreBonusIdsForMatch(m.id, off, false);
  let max = 0;
  for (const p of getParticipantsForDisplay()) {
    const store = loadPredictions(p.id);
    if (store.groupScoresConfirmed?.[m.id] !== true) continue;
    const pred = store.groupScores[m.id] ?? { home: "", away: "" };
    const pts = computeGroupMatchPoints(
      off,
      pred,
      improbableSign,
      scoring,
      false,
      closestIds.has(p.id),
    );
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
  const closestIds = getClosestScoreBonusIdsForMatch(m.id, off, true);
  let max = 0;
  for (const p of getParticipantsForDisplay()) {
    const store = loadPredictions(p.id);
    if (store.knockoutScoresConfirmed?.[m.id] !== true) continue;
    const pred = store.knockoutScores?.[m.id] ?? { home: "", away: "" };
    const pts = computeGroupMatchPoints(
      off,
      pred,
      improbableSign,
      scoring,
      koPenPh,
      closestIds.has(p.id),
    );
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
      const closestEligible = officialComplete
        ? getClosestScoreBonusIdsForMatch(m.id, off, false).has(participantId)
        : false;
      const pts =
        officialComplete && predConfirmed
          ? computeGroupMatchPoints(off, pred, improbableSign, scoring, false, closestEligible)
          : null;
      const breakdown =
        officialComplete && predConfirmed
          ? computeGroupMatchPointsBreakdown(off, pred, improbableSign, scoring, false, closestEligible)
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
      const closestEligible = officialComplete
        ? getClosestScoreBonusIdsForMatch(m.id, off, true).has(participantId)
        : false;
      const pts =
        officialComplete && predConfirmed
          ? computeGroupMatchPoints(off, pred, improbableSign, scoring, koPenPh, closestEligible)
          : null;
      const breakdown =
        officialComplete && predConfirmed
          ? computeGroupMatchPointsBreakdown(
              off,
              pred,
              improbableSign,
              scoring,
              koPenPh,
              closestEligible,
            )
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

/** @returns {"partidos" | "predicciones"} */
function getMatchHistoryView() {
  try {
    const v = localStorage.getItem(MATCH_HISTORY_VIEW_KEY);
    return v === "predicciones" ? "predicciones" : "partidos";
  } catch {
    return "partidos";
  }
}

/** @param {"partidos" | "predicciones"} view */
function setMatchHistoryView(view) {
  try {
    localStorage.setItem(MATCH_HISTORY_VIEW_KEY, view);
  } catch {
    /* ignore */
  }
}

function applyMatchHistoryViewVisibility(view) {
  const partidosView = $("#match-history-view-partidos");
  const predsView = $("#match-history-view-predicciones");
  const showPreds = view === "predicciones";
  if (partidosView) partidosView.hidden = showPreds;
  if (predsView) predsView.hidden = !showPreds;
}

function syncMatchHistoryViewRadios() {
  const view = getMatchHistoryView();
  document.querySelectorAll('input[name="match-history-view"]').forEach((r) => {
    r.checked = r.value === view;
  });
}

/**
 * Marcador de predicción con el mismo layout que Partidos: bandera país · goles · goles · país bandera.
 * @param {string} homeTeamHtml
 * @param {string} awayTeamHtml
 * @param {{ home?: string | number, away?: string | number, penaltyWinner?: string }} pred
 * @param {string} [roundId]
 */
function predictionHistoryScoreGridHtml(homeTeamHtml, awayTeamHtml, pred, roundId) {
  const h = pred?.home === "" || pred?.home == null ? "—" : escapeHtml(String(pred.home));
  const a = pred?.away === "" || pred?.away == null ? "—" : escapeHtml(String(pred.away));
  const bothFilled = pred?.home !== "" && pred?.home != null && pred?.away !== "" && pred?.away != null;
  const homeCls = bothFilled ? officialScoreOutcomeClass(pred.home, pred.away, "home") : "";
  const awayCls = bothFilled ? officialScoreOutcomeClass(pred.home, pred.away, "away") : "";
  let penHtml = "";
  if (
    roundId &&
    knockoutRoundRequiresPenaltyPickOnDraw(roundId) &&
    bothFilled &&
    predictionOutcomeSign(pred) === "d" &&
    (pred?.penaltyWinner === "home" || pred?.penaltyWinner === "away")
  ) {
    penHtml =
      pred.penaltyWinner === "home"
        ? '<p class="pred-history-match__pen muted">Ganador en penales: local</p>'
        : '<p class="pred-history-match__pen muted">Ganador en penales: visitante</p>';
  }
  return `<div class="quiniela-official-grid quiniela-official-grid--readonly pred-history-match-grid" role="group" aria-label="Tu predicción">
    <div class="quiniela-cell quiniela-cell--team">${homeTeamHtml}</div>
    <div class="quiniela-cell quiniela-cell--score${homeCls}">${h}</div>
    <div class="quiniela-cell quiniela-cell--score${awayCls}">${a}</div>
    <div class="quiniela-cell quiniela-cell--team">${awayTeamHtml}</div>
  </div>${penHtml}`;
}

/**
 * @param {string} participantId
 * @returns {string}
 */
function buildPredictionHistoryHtml(participantId) {
  const pStore = loadPredictions(participantId);
  /** @type {Array<{ m: (typeof GROUP_MATCHES)[number] | ReturnType<typeof getKnockoutMatchesFlat>[number], kind: "group" | "ko", dayKey: string, sortT: number }>} */
  const items = [
    ...GROUP_MATCHES.map((m) => ({
      m,
      kind: /** @type {const} */ ("group"),
      dayKey: calendarDayKeyForKickoff(m.kickoff),
      sortT: m.kickoff ? Date.parse(m.kickoff) : Number.POSITIVE_INFINITY,
    })),
    ...getKnockoutMatchesFlat().map((m) => ({
      m,
      kind: /** @type {const} */ ("ko"),
      dayKey: calendarDayKeyForKickoff(m.kickoff),
      sortT: m.kickoff ? Date.parse(m.kickoff) : Number.POSITIVE_INFINITY,
    })),
  ];
  items.sort((a, b) => {
    if (a.dayKey !== b.dayKey) {
      if (!a.dayKey) return 1;
      if (!b.dayKey) return -1;
      return a.dayKey.localeCompare(b.dayKey);
    }
    if (a.sortT !== b.sortT) return a.sortT - b.sortT;
    return String(a.m.id).localeCompare(String(b.m.id));
  });

  /** @type {Map<string, string[]>} */
  const byDay = new Map();
  for (const item of items) {
    const key = item.dayKey || "__sin_fecha__";
    if (!byDay.has(key)) byDay.set(key, []);
    const { m, kind } = item;
    let contextLabel;
    let homeHtml;
    let awayHtml;
    let pred;
    let roundId;
    if (kind === "group") {
      contextLabel = `Grupo ${m.groupId}`;
      homeHtml = teamLabelHtml(m.home);
      awayHtml = teamLabelHtml(m.away);
      pred = pStore.groupScores?.[m.id] ?? { home: "", away: "" };
    } else {
      const { ri, mi } = getKoRoundMatchIndex(m.id);
      const homeLab = resolveKnockoutSlotLabel(ri, mi, "home", pStore.knockoutScores ?? {});
      const awayLab = resolveKnockoutSlotLabel(ri, mi, "away", pStore.knockoutScores ?? {});
      contextLabel = knockoutPhaseTitle(m.roundId);
      homeHtml = bracketTeamLineHtml(homeLab);
      awayHtml = bracketTeamLineHtml(awayLab);
      pred = pStore.knockoutScores?.[m.id] ?? { home: "", away: "" };
      roundId = m.roundId;
    }
    const kickoffMeta = m.kickoff
      ? `<span class="pred-history-match__time muted">${escapeHtml(formatKickoffShortSpanish(m.kickoff))}</span>`
      : "";
    const matchHtml = `<article class="card pred-history-match">
      <div class="pred-history-match__head">
        <span class="pred-history-match__context">${escapeHtml(contextLabel)}</span>
        ${kickoffMeta}
      </div>
      ${predictionHistoryScoreGridHtml(homeHtml, awayHtml, pred, roundId)}
    </article>`;
    byDay.get(key).push(matchHtml);
  }

  if (byDay.size === 0) {
    return '<p class="muted">No hay partidos en el calendario.</p>';
  }

  const daySections = [];
  for (const [dayKey, matches] of byDay) {
    const sampleKickoff = items.find((it) => (it.dayKey || "__sin_fecha__") === dayKey)?.m.kickoff;
    const title =
      dayKey === "__sin_fecha__"
        ? "Sin fecha"
        : sampleKickoff
          ? formatKickoffDayLabelSpanish(sampleKickoff)
          : dayKey;
    daySections.push(`<section class="pred-history-day">
      <h2 class="pred-history-day__title">${escapeHtml(title)}</h2>
      <div class="pred-history-day__matches">${matches.join("")}</div>
    </section>`);
  }
  return daySections.join("");
}

function redrawMatchHistory() {
  ensureMatchHistoryViewSelect();
  const body = $("#table-match-history-body");
  const totals = $("#match-history-totals");
  const predsRoot = $("#match-history-preds-root");
  const session = loadSession();
  const view = getMatchHistoryView();
  syncMatchHistoryViewRadios();
  applyMatchHistoryViewVisibility(view);
  if (!body || !totals) return;
  if (!session) {
    body.innerHTML = "";
    totals.textContent = "";
    if (predsRoot) predsRoot.innerHTML = "";
    return;
  }
  if (view === "predicciones") {
    if (predsRoot) predsRoot.innerHTML = buildPredictionHistoryHtml(session.participantId);
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

function ensureMatchHistoryViewSelect() {
  const radios = [...document.querySelectorAll('input[name="match-history-view"]')];
  if (radios.length === 0 || radios[0].dataset.ready === "1") return;
  const preferred = getMatchHistoryView();
  radios.forEach((r) => {
    r.checked = r.value === preferred;
    r.addEventListener("change", () => {
      const checked = document.querySelector('input[name="match-history-view"]:checked');
      const next = checked?.value === "predicciones" ? "predicciones" : "partidos";
      setMatchHistoryView(next);
      redrawMatchHistory();
    });
    r.dataset.ready = "1";
  });
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
 * @param {boolean} [kickoffLocked=false]
 * @param {boolean} [matchLive=false] kickoff pasado o admin inició (aunque el estado oficial siga en ready un instante)
 */
function quinielaMatchStatusBanner(
  matchStage,
  officialConfirmed,
  groupTeamsDecided = true,
  kickoffLocked = false,
  matchLive = false,
) {
  if (matchStage === "ready") {
    if (groupTeamsDecided === false) {
      return `<p class="quiniela-match-status quiniela-match-status--pending" role="status"><strong>Equipos por definir.</strong> Las predicciones están bloqueadas hasta que ambos equipos del partido estén fijados (sin «Por determinar»).</p>`;
    }
    if (matchLive || kickoffLocked) {
      return `<p class="quiniela-match-status quiniela-match-status--live" role="status"><strong>En juego.</strong> Las predicciones están cerradas; el marcador oficial lo actualiza el admin.</p>`;
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
function renderQuinielaMatchCard(m, session, official, isAdmin, nextJornadaIds, openAccordionMatchIds = null) {
  const accOpenAttr = openAccordionMatchIds?.has(m.id) ? " open" : "";
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
  const pStorePrev = loadPredictions(session.participantId);
  const userPredConfirmed = isUserPredictionConfirmedStore(pStorePrev, m);
  const matchClosed = isMatchOfficiallyClosed(official, m);
  const matchInProgress = isMatchLiveInPlay(official, m);
  const kickoffLocked = isLockedAtKickoff(m.kickoff);
  const cornerHtml = partidosMatchCornerHtml(m, nextJornadaIds, userPredConfirmed, matchClosed, matchInProgress);
  const noKickHtml = partidosAccNoKickoffHintHtml(m);
  const officialPreview = partidosOfficialPreviewLineGroup(m, official);
  const predInlineHtml = !m.kickoff
    ? `<div class="partidos-acc__pred-row">${partidosUserPredPillHtml(userPredConfirmed, "inline", matchClosed)}</div>`
    : "";
  const mobileSummary = partidosAccSummaryMobileHtml({
    contextLabel: `Grupo ${m.groupId}`,
    homeTeamsHtml: teamLabelHtml(m.home),
    awayTeamsHtml: teamLabelHtml(m.away),
    m,
    nextJornadaIds,
    matchInProgress,
    userPredConfirmed,
    matchOfficiallyClosed: matchClosed,
    closedHomeScore: matchClosed ? off.home : "",
    closedAwayScore: matchClosed ? off.away : "",
  });
  const kickCls = m.kickoff ? " partidos-match-card--has-kickoff" : "";

  const vh = off.home === "" ? "" : escapeHtml(String(off.home));
  const va = off.away === "" ? "" : escapeHtml(String(off.away));

  let officialHtml;
  if (canManagePartidosMatchFlow(session.participantId)) {
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
          <div class="quiniela-cell quiniela-cell--score">${scoreStepperHtml(m.id, "home", off.home, { extraClass: "quiniela-official-stepper", disabled: false, idAttr: "data-ogid" })}</div>
          <div class="quiniela-cell quiniela-cell--score">${scoreStepperHtml(m.id, "away", off.away, { extraClass: "quiniela-official-stepper", disabled: false, idAttr: "data-ogid" })}</div>
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
      <details class="partidos-acc"${accOpenAttr}>
        <summary class="partidos-acc__summary">
          <span class="partidos-acc__chev" aria-hidden="true"></span>
          <div class="partidos-acc__summary-main">
            ${mobileSummary}
            ${partidosAccSummaryDesktopHtml({
              contextLabel: `Grupo ${m.groupId}`,
              homeTeamsHtml: teamLabelHtml(m.home),
              awayTeamsHtml: teamLabelHtml(m.away),
              accessibleTitle: `Grupo ${m.groupId}: ${m.home} vs ${m.away}`,
              matchOfficiallyClosed: matchClosed,
              closedHomeScore: matchClosed ? off.home : "",
              closedAwayScore: matchClosed ? off.away : "",
              noKickHtml,
              predInlineHtml,
              officialPreview,
            })}
          </div>
        </summary>
        <div class="partidos-acc__body">
          ${partidosAccKickoffBodyHtml(m)}
          ${quinielaMatchStatusBanner(matchStage, officialConfirmed, groupTeamsDecided, kickoffLocked, matchInProgress)}
          ${officialHtml}
          <div class="quiniela-preds-head-row">
            <div class="quiniela-preds-head">Predicciones</div>
            ${participantSearchToolbarHtml({ ariaLabel: "Buscar jugador en este partido" })}
          </div>
          ${buildMatchVoteBarsHtml(m.home, m.away, m.id, false)}
          <div class="${quinielaPredsTableWrapClass()}">
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
              ${partidosPredsLazyTbodyHtml()}
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
  const session = loadSession();
  for (const mid of ids) {
    const art = wrap.querySelector(`article.quiniela-match[data-quiniela-mid="${CSS.escape(mid)}"]`);
    const det = art?.querySelector("details.partidos-acc");
    if (det instanceof HTMLDetailsElement) {
      det.open = true;
      if (art instanceof HTMLElement && session) scheduleHydratePartidosMatchPredsTable(art, session);
    }
  }
}

/**
 * Si el foco está en Partidos (p. ej. stepper del 2.º partido abierto), tras `innerHTML` el navegador
 * suele enfocar el primer acordeón y subir el scroll. Guardamos tarjeta + selector para restaurar.
 * Los botones ± dejan el foco en `.score-stepper__btn`. En escritorio resolvemos al input del mismo stepper;
 * en móvil mantenemos el botón para no abrir el teclado al restaurar foco tras re-render.
 * @param {HTMLElement | null | undefined} el
 * @param {HTMLElement | null} wrap
 * @returns {{ articleMid: string, focusSelector: string | null } | null}
 */
function capturePartidosInteractionAnchorFromElement(el, wrap) {
  if (!wrap || !(el instanceof HTMLElement) || !wrap.contains(el)) return null;
  if (el.matches(".score-stepper__btn") && !isMobileLayout()) {
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
  if (!el.matches(".score-stepper__input") && !el.matches(".score-stepper__btn")) {
    return { articleMid, focusSelector: null };
  }
  const side = el.dataset.side === "away" ? "away" : "home";
  const isBtn = el.matches(".score-stepper__btn");
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
  const ogid = el.getAttribute("data-ogid");
  let tail = "";
  if (kid) {
    tail = `[data-kid="${CSS.escape(kid)}"][data-side="${side}"]`;
  } else if (okid) {
    tail = `[data-okid="${CSS.escape(okid)}"][data-side="${side}"]`;
  } else if (ogid) {
    tail = `[data-ogid="${CSS.escape(ogid)}"][data-side="${side}"]`;
  } else if (midAttr) {
    tail = `[data-mid="${CSS.escape(midAttr)}"][data-side="${side}"]`;
  } else {
    return { articleMid, focusSelector: null };
  }
  const deltaAttr = isBtn ? `[data-delta="${el.dataset.delta === "1" ? "1" : "-1"}"]` : "";
  const stepperRole = isBtn ? "btn" : "input";
  return { articleMid, focusSelector: `${scope}.score-stepper__${stepperRole}${tail}${deltaAttr}` };
}

/** @param {HTMLElement | null} wrap */
function capturePartidosInteractionAnchor(wrap) {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return null;
  return capturePartidosInteractionAnchorFromElement(el, wrap);
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
    if (!isMobileLayout() && focusTarget instanceof HTMLElement) {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        focusTarget.focus();
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

  applyKickoffAutoStarts();
  official = loadOfficialResults();

  const isAdmin = canEditOfficialResults(session.participantId);
  const scope = getPartidosUnderlyingScope();
  const allCal = allMatchesForPartidosCalendar();
  const nextHighlightIds = getNextMatchDayHighlightIds(official, allCal);
  const showOnlyProximosNav = partidosSiguientesVistaActiva();
  const showTerminados = scope === PARTIDOS_VISTA_TERMINADOS_VALUE;
  setPartidosGroupToolbarVisible(shouldShowPartidosGroupToolbar());

  const openAccordionMatchIds = collectOpenPartidosAccordionIds(wrap);
  const blocks = [];
  if (showOnlyProximosNav) {
    /** Atajo del menú: la jornada próxima puede mezclar grupos y KO; no limitar por Vista ni por filtro de grupo. */
    let proximos = allCal.filter((m) => nextHighlightIds.has(m.id));
    proximos = sortPartidosByLiveSiguientesKickoff(proximos, nextHighlightIds, official);
    for (const m of proximos) {
      if (m.groupId != null) {
        blocks.push(renderQuinielaMatchCard(m, session, official, isAdmin, nextHighlightIds, openAccordionMatchIds));
      } else {
        blocks.push(renderQuinielaMatchCardKo(m, session, official, isAdmin, nextHighlightIds, openAccordionMatchIds));
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
        blocks.push(renderQuinielaMatchCard(m, session, official, isAdmin, noNextHighlight, openAccordionMatchIds));
      } else {
        blocks.push(renderQuinielaMatchCardKo(m, session, official, isAdmin, noNextHighlight, openAccordionMatchIds));
      }
    }
  } else if (scope === "grupos") {
    const filterEl = $("#quiniela-group-filter");
    const groupFilter = filterEl?.value ?? "";
    let matches = groupFilter ? GROUP_MATCHES.filter((m) => m.groupId === groupFilter) : GROUP_MATCHES;
    matches = sortPartidosByLiveSiguientesKickoff(matches, nextHighlightIds, official);
    blocks.push(
      ...matches.map((m) =>
        renderQuinielaMatchCard(m, session, official, isAdmin, nextHighlightIds, openAccordionMatchIds),
      ),
    );
  } else {
    let koList = getKnockoutMatchesFlat();
    if (scope !== "all-ko") koList = koList.filter((x) => x.roundId === scope);
    koList = sortPartidosByLiveSiguientesKickoff(koList, nextHighlightIds, official);
    blocks.push(
      ...koList.map((m) =>
        renderQuinielaMatchCardKo(m, session, official, isAdmin, nextHighlightIds, openAccordionMatchIds),
      ),
    );
  }
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
  stampAllQuinielaPredictionMetas(wrap, session, official);
  syncQuinielaPerfectBonusCanvases(wrap);
  syncGroupPtsBadgeCanvases(wrap);

  if (canManagePartidosMatchFlow(session.participantId)) bindPartidosAdminHandlers(wrap, session);

  if (blocks.length > 0) restoreOpenPartidosAccordions(wrap, openAccordionMatchIds);
  restorePartidosInteractionAnchor(wrap, partidosInteractionAnchor, partidosViewportLock);

  syncQuinielaPerfectBonusCanvases(wrap);
  requestAnimationFrame(() => syncQuinielaPerfectBonusCanvases(wrap));

  if (!wrap.dataset.partidosAccToggleBound) {
    wrap.dataset.partidosAccToggleBound = "1";
    wrap.addEventListener(
      "toggle",
      (e) => {
        const det = e.target;
        if (!(det instanceof HTMLDetailsElement) || !det.classList.contains("partidos-acc") || !det.open) {
          return;
        }
        const card = det.closest("article.partidos-match-card");
        const sess = loadSession();
        if (card instanceof HTMLElement && sess) {
          scheduleHydratePartidosMatchPredsTable(card, sess);
        } else {
          deferPartidosCardCanvasSync(card ?? wrap);
        }
      },
      true,
    );
  }

  if (isArenaMode()) syncParticipantSearchInputs();
  if (isArenaMode()) syncArenaTruncationHints();
  scheduleSyncQuinielaTableHorizontalScroll(wrap);
}

/**
 * @param {Record<string, { home: string|number|"", away: string|number|"" }>} groupScores
 * @param {{ simplified?: boolean }} [opts]
 */
function buildTeamStatsTableBody(groupScores, opts = {}) {
  const { simplified = false, withPts = true } = opts;
  const rows = [];
  const standingsByGroup = computeGroupStandingsByGroup(groupScores);

  for (const grp of GROUPS) {
    const ordered = standingsByGroup[grp.id] ?? [];
    const colSpan = simplified ? (withPts ? 3 : 2) : withPts ? 7 : 6;

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
          ${withPts ? `<td>${s.pts}</td>` : ""}
        </tr>
      `);
    });
  }

  return rows.join("");
}

function buildTeamStatsSingleGroupCardHtml(grp, ordered, withPts = true) {
  const tableClass = withPts
    ? "table table-compact team-tables-single-table"
    : "table table-compact team-tables-single-table team-tables-single-table--no-pts";
  const rows = ordered
    .map(
      (s, idx) => `
        <tr>
          <td class="team-tables-single-pos">${idx + 1}</td>
          <td class="team-tables-single-team">${teamLabelHtml(s.team)}</td>
          ${withPts ? `<td class="team-tables-single-pts">${s.pts}</td>` : ""}
        </tr>
      `,
    )
    .join("");
  return `
    <div class="team-tables-single-group" data-group-id="${escapeHtml(grp.id)}">
      <div class="team-tables-single-group__head">Grupo ${escapeHtml(grp.id)}</div>
      <table class="${tableClass}">
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildTeamStatsSingleGridHtml(groupScores, opts = {}) {
  const { withPts = true } = opts;
  const standingsByGroup = computeGroupStandingsByGroup(groupScores);
  return GROUPS.map((grp) =>
    buildTeamStatsSingleGroupCardHtml(grp, standingsByGroup[grp.id] ?? [], withPts),
  ).join("");
}

function buildTeamStatsCompareSyncHtml(leftScores, rightScores) {
  const leftStandings = computeGroupStandingsByGroup(leftScores);
  const rightStandings = computeGroupStandingsByGroup(rightScores);
  return GROUPS.map(
    (grp) => `
    <div class="team-tables-compare-sync-row">
      <div class="team-tables-compare-sync-cell">${buildTeamStatsSingleGroupCardHtml(grp, leftStandings[grp.id] ?? [], false)}</div>
      <div class="team-tables-compare-sync-cell">${buildTeamStatsSingleGroupCardHtml(grp, rightStandings[grp.id] ?? [], false)}</div>
    </div>
  `,
  ).join("");
}

function buildTeamOrderSingleOfficialGroupCard(grp, officialSnapshot, opts = {}) {
  const { reservePtsCol = false, syncHead = false } = opts;
  const order = Array.isArray(officialSnapshot.orderByGroup?.[grp.id])
    ? officialSnapshot.orderByGroup[grp.id]
    : [];
  const rows = [0, 1, 2, 3]
    .map((i) => {
      const t = order[i] ?? "";
      return `
        <tr>
          <td class="team-tables-single-pos">${i + 1}</td>
          <td class="team-tables-single-team">${t ? teamLabelHtml(t) : '<span class="muted">—</span>'}</td>
          ${reservePtsCol ? '<td class="team-tables-single-pts"><span class="muted">—</span></td>' : ""}
        </tr>
      `;
    })
    .join("");
  const tableClass = reservePtsCol
    ? "table table-compact team-tables-single-table team-tables-single-table--order"
    : "table table-compact team-tables-single-table team-tables-single-table--order team-tables-single-table--no-pts";
  const headClass = syncHead
    ? "team-tables-single-group__head team-tables-single-group__head--sync"
    : "team-tables-single-group__head";
  return `
    <div class="team-tables-single-group" data-group-id="${escapeHtml(grp.id)}">
      <div class="${headClass}">Grupo ${escapeHtml(grp.id)}</div>
      <table class="${tableClass}">
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildTeamOrderSinglePredGroupCard(grp, orderByGroup, officialSnapshot, participantId, opts = {}) {
  const { withPts = true, syncHead = false } = opts;
  const pStore = loadPredictions(participantId);
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
      (i) => Boolean(predOrder[i]) && Boolean(officialOrder[i]) && predOrder[i] === officialOrder[i],
    );
  const perfectOrderPts = GROUP_QUALIFIERS_ORDER_BONUS + GROUP_PERFECT_ORDER_BONUS;
  const thirdAdvanceHit =
    hasOfficialData &&
    officialThirdDefined &&
    (predThird === true || predThird === false) &&
    predThird === officialThird;
  let groupBadge = "";
  if (withPts) {
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
  }

  const rows = [0, 1, 2, 3]
    .map((i) => {
      const t = predOrder[i] ?? "";
      let ptsCell = "";
      if (withPts) {
        const hitExact =
          hasOfficialData && Boolean(t) && Boolean(officialOrder[i]) && t === officialOrder[i];
        const rowBasePts =
          hasOfficialData && i < 2 && Boolean(t) && officialQualifiers.has(t)
            ? 1
            : hitExact && i >= 2
              ? 1
              : 0;
        const rowBonusPts =
          hitExact && hasUniquePickBonus(voteCountsByPos[i], t) ? 1 : 0;
        const rowPts = rowBasePts + rowBonusPts;
        ptsCell = `<td class="team-tables-single-pts">${pointsBadgeHtml(rowPts, {
          bonus: rowBonusPts > 0,
          title:
            rowBonusPts > 0
              ? rowBasePts > 0
                ? "Acierto en posición con bono por minoría (+1 base +1 bono)"
                : "Acierto en posición con bono por minoría (+1 bono)"
              : rowBasePts > 0 && i >= 2
                ? "Posición exacta acertada (+1)"
                : "Clasificado directo acertado (+1)",
        }) || '<span class="muted">—</span>'}</td>`;
      }
      return `
        <tr>
          <td class="team-tables-single-pos">${i + 1}</td>
          <td class="team-tables-single-team">${t ? teamLabelHtml(t) : '<span class="muted">—</span>'}</td>
          ${ptsCell}
        </tr>
      `;
    })
    .join("");

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
  const totalClass = teamOrderGroupTotalClass(groupTotal, false);
  const totalHtml =
    !syncHead && withPts && hasOfficialData && groupTotal > 0
      ? `<span class="team-tables-single-group__total"><strong class="${totalClass}">${groupTotal}</strong></span>`
      : "";
  const headClass = syncHead
    ? "team-tables-single-group__head team-tables-single-group__head--sync"
    : withPts && (groupBadge || totalHtml)
      ? "team-tables-single-group__head team-tables-single-group__head--rich"
      : "team-tables-single-group__head";
  const headBadge = syncHead ? "" : groupBadge;
  const tableClass = withPts
    ? "table table-compact team-tables-single-table team-tables-single-table--order"
    : "table table-compact team-tables-single-table team-tables-single-table--order team-tables-single-table--no-pts";

  return {
    html: `
      <div class="team-tables-single-group" data-group-id="${escapeHtml(grp.id)}">
        <div class="${headClass}">
          <span class="team-tables-single-group__title">Grupo ${escapeHtml(grp.id)}</span>
          ${headBadge ? `<span class="team-tables-single-group__badge">${headBadge}</span>` : ""}
          ${totalHtml}
        </div>
        <table class="${tableClass}">
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
    groupTotal,
  };
}

function buildTeamOrderSingleGroupCardHtml(grp, sourceId, sessionParticipantId, opts = {}) {
  const { withPts = true, reservePtsCol = false, syncHead = false } = opts;
  const officialSnapshot = getLiveOfficialGroupSnapshot();
  const showPtsCol = withPts || reservePtsCol;
  if (sourceId === "official") {
    return buildTeamOrderSingleOfficialGroupCard(grp, officialSnapshot, {
      reservePtsCol: showPtsCol,
    });
  }
  const orderByGroup = loadPredictions(sourceId).groupOrder ?? {};
  return buildTeamOrderSinglePredGroupCard(grp, orderByGroup, officialSnapshot, sourceId, {
    withPts: showPtsCol,
    syncHead,
  }).html;
}

function buildTeamOrderCompareSyncHtml(leftSource, rightSource, sessionParticipantId) {
  const leftMeta = buildTeamOrderSingleGridHtml(leftSource, sessionParticipantId, { withPts: true });
  const rightMeta = buildTeamOrderSingleGridHtml(rightSource, sessionParticipantId, { withPts: true });
  const rows = GROUPS.map(
    (grp) => `
    <div class="team-tables-compare-sync-row">
      <div class="team-tables-compare-sync-cell">${buildTeamOrderSingleGroupCardHtml(grp, leftSource, sessionParticipantId, { withPts: true, reservePtsCol: true, syncHead: true })}</div>
      <div class="team-tables-compare-sync-cell">${buildTeamOrderSingleGroupCardHtml(grp, rightSource, sessionParticipantId, { withPts: true, reservePtsCol: true, syncHead: true })}</div>
    </div>
  `,
  ).join("");
  return { html: rows, leftMeta, rightMeta };
}

function buildTeamOrderSingleGridHtml(sourceId, sessionParticipantId, opts = {}) {
  const { withPts = true, syncHead = false, reservePtsCol = false } = opts;
  const officialSnapshot = getLiveOfficialGroupSnapshot();
  const showPtsCol = withPts || reservePtsCol;
  if (sourceId === "official") {
    return {
      html: GROUPS.map((grp) =>
        buildTeamOrderSingleOfficialGroupCard(grp, officialSnapshot, { reservePtsCol: showPtsCol, syncHead }),
      ).join(""),
      grandTotal: GROUPS.length * MAX_PER_GROUP,
      grandTotalLabel: "Total posible",
      showGrandTotal: withPts,
    };
  }

  const orderByGroup = loadPredictions(sourceId).groupOrder ?? {};
  let grandTotal = 0;
  const html = GROUPS.map((grp) => {
    const card = buildTeamOrderSinglePredGroupCard(grp, orderByGroup, officialSnapshot, sourceId, {
      withPts: showPtsCol,
      syncHead,
    });
    grandTotal += card.groupTotal;
    return card.html;
  }).join("");
  return {
    html,
    grandTotal,
    grandTotalLabel: "Total final",
    showGrandTotal: withPts,
  };
}

function getTeamTablesLayoutValue(name, storageKey) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  if (checked?.value === "compare" || checked?.value === "single") return checked.value;
  const saved = localStorage.getItem(storageKey);
  return saved === "compare" ? "compare" : "single";
}

function getTeamStatsWithPtsPreference() {
  const checked = document.querySelector('input[name="team-stats-single-pts"]:checked');
  if (checked?.value === "without-pts") return false;
  if (checked?.value === "with-pts") return true;
  let saved = localStorage.getItem(TEAM_STATS_SINGLE_PTS_KEY);
  if (!saved) saved = localStorage.getItem(TEAM_STATS_VIEW_KEY);
  return saved !== "without-pts";
}

function getTeamOrderWithPtsPreference() {
  const checked = document.querySelector('input[name="team-order-single-pts"]:checked');
  if (checked?.value === "without-pts") return false;
  if (checked?.value === "with-pts") return true;
  const saved = localStorage.getItem(TEAM_ORDER_SINGLE_PTS_KEY);
  return saved !== "without-pts";
}

function getTeamStatsCompareSimplified() {
  if (isMobileLayout()) return true;
  const checked = document.querySelector('input[name="team-stats-compare-view"]:checked');
  if (checked?.value === "simple") return true;
  if (checked?.value === "full") return false;
  let saved = localStorage.getItem(TEAM_STATS_COMPARE_VIEW_KEY);
  if (!saved) saved = localStorage.getItem(TEAM_STATS_VIEW_KEY);
  return saved === "simple";
}

function ensureTeamStatsLayoutSelect() {
  const radios = [...document.querySelectorAll('input[name="team-stats-layout"]')];
  if (radios.length === 0 || radios[0].dataset.ready === "1") return;
  const saved = localStorage.getItem(TEAM_STATS_LAYOUT_KEY);
  const preferred = saved === "compare" ? "compare" : "single";
  radios.forEach((r) => {
    r.checked = r.value === preferred;
    r.addEventListener("change", () => {
      const checked = document.querySelector('input[name="team-stats-layout"]:checked');
      const next = checked?.value === "compare" ? "compare" : "single";
      localStorage.setItem(TEAM_STATS_LAYOUT_KEY, next);
      redrawTeamStats();
    });
    r.dataset.ready = "1";
  });
}

function ensureTeamOrderLayoutSelect() {
  const radios = [...document.querySelectorAll('input[name="team-order-layout"]')];
  if (radios.length === 0 || radios[0].dataset.ready === "1") return;
  const saved = localStorage.getItem(TEAM_ORDER_LAYOUT_KEY);
  const preferred = saved === "compare" ? "compare" : "single";
  radios.forEach((r) => {
    r.checked = r.value === preferred;
    r.addEventListener("change", () => {
      const checked = document.querySelector('input[name="team-order-layout"]:checked');
      const next = checked?.value === "compare" ? "compare" : "single";
      localStorage.setItem(TEAM_ORDER_LAYOUT_KEY, next);
      redrawTeamOrder();
    });
    r.dataset.ready = "1";
  });
}

function ensureTeamStatsSingleSelect() {
  const single = $("#team-stats-single-source");
  if (!single || single.dataset.ready === "1") return;
  single.innerHTML = teamStatsSourceOptionsHtml();
  single.addEventListener("change", () => {
    localStorage.setItem(TEAM_STATS_SINGLE_SOURCE_KEY, single.value);
    redrawTeamStats();
  });
  single.dataset.ready = "1";
}

function ensureTeamOrderSingleSelect() {
  const single = $("#team-order-single-source");
  if (!single || single.dataset.ready === "1") return;
  single.innerHTML = teamOrderSourceOptionsHtml();
  single.addEventListener("change", () => {
    localStorage.setItem(TEAM_ORDER_SINGLE_SOURCE_KEY, single.value);
    redrawTeamOrder();
  });
  single.dataset.ready = "1";
}

function ensureTeamOrderSinglePtsSelect() {
  const radios = [...document.querySelectorAll('input[name="team-order-single-pts"]')];
  if (radios.length === 0 || radios[0].dataset.ready === "1") return;
  const saved = localStorage.getItem(TEAM_ORDER_SINGLE_PTS_KEY);
  const preferred = saved === "without-pts" ? "without-pts" : "with-pts";
  radios.forEach((r) => {
    r.checked = r.value === preferred;
    r.addEventListener("change", () => {
      const checked = document.querySelector('input[name="team-order-single-pts"]:checked');
      const next = checked?.value === "without-pts" ? "without-pts" : "with-pts";
      localStorage.setItem(TEAM_ORDER_SINGLE_PTS_KEY, next);
      redrawTeamOrder();
    });
    r.dataset.ready = "1";
  });
}

function refreshTeamStatsSingleSourceValue(defaultParticipantId) {
  const single = $("#team-stats-single-source");
  if (!single) return;
  const valid = (val) => [...single.options].some((o) => o.value === val);
  const saved = localStorage.getItem(TEAM_STATS_SINGLE_SOURCE_KEY);
  if (saved && valid(saved)) {
    single.value = saved;
  } else if (defaultParticipantId && valid(defaultParticipantId)) {
    single.value = defaultParticipantId;
  } else {
    single.value = single.options[0]?.value ?? "official";
  }
}

function refreshTeamOrderSingleSourceValue(defaultParticipantId) {
  const single = $("#team-order-single-source");
  if (!single) return;
  const valid = (val) => [...single.options].some((o) => o.value === val);
  const saved = localStorage.getItem(TEAM_ORDER_SINGLE_SOURCE_KEY);
  if (saved && valid(saved)) {
    single.value = saved;
  } else if (defaultParticipantId && valid(defaultParticipantId)) {
    single.value = defaultParticipantId;
  } else {
    single.value = single.options[0]?.value ?? "official";
  }
}

function applyTeamTablesSinglePanelTone(panelEl, sourceId, sessionParticipantId) {
  if (!panelEl) return;
  panelEl.classList.remove(
    "team-stats-col-tone--official",
    "team-stats-col-tone--self",
    "team-stats-col-tone--other",
    "team-order-col--official",
    "team-order-col--self",
    "team-order-col--other",
  );
  const tone =
    sourceId === "official"
      ? "team-stats-col-tone--official team-order-col--official"
      : sourceId === sessionParticipantId
        ? "team-stats-col-tone--self team-order-col--self"
        : "team-stats-col-tone--other team-order-col--other";
  panelEl.classList.add(...tone.split(" "));
}

function syncTeamTablesCompareCompactClass(panelEl, useCompact) {
  panelEl?.classList.toggle("team-tables-compare--compact", useCompact);
}

function setTeamTablesCompareGrandTotal(el, gridMeta) {
  if (!el) return;
  if (!gridMeta?.showGrandTotal) {
    el.textContent = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `<strong>${escapeHtml(gridMeta.grandTotalLabel)}:</strong> <strong>${gridMeta.grandTotal}</strong>`;
}

function renderTeamStatsCompareHosts({
  useCompact,
  leftScores,
  rightScores,
  simplified,
  withPts,
  officialBody,
  predBody,
  leftGrid,
  rightGrid,
  syncWrap,
  syncRows,
  syncSubLeft,
  syncSubRight,
  leftSubtitle,
  rightSubtitle,
}) {
  if (useCompact) {
    if (syncWrap) syncWrap.hidden = true;
    if (syncRows) syncRows.innerHTML = "";
    if (leftGrid) {
      leftGrid.innerHTML = buildTeamStatsSingleGridHtml(leftScores, { withPts });
      leftGrid.hidden = false;
    }
    if (rightGrid) {
      rightGrid.innerHTML = buildTeamStatsSingleGridHtml(rightScores, { withPts });
      rightGrid.hidden = false;
    }
    if (officialBody) officialBody.innerHTML = "";
    if (predBody) predBody.innerHTML = "";
    return;
  }
  if (syncWrap) syncWrap.hidden = true;
  if (syncRows) syncRows.innerHTML = "";
  if (leftGrid) {
    leftGrid.innerHTML = "";
    leftGrid.hidden = true;
  }
  if (rightGrid) {
    rightGrid.innerHTML = "";
    rightGrid.hidden = true;
  }
  if (officialBody) officialBody.innerHTML = buildTeamStatsTableBody(leftScores, { simplified, withPts });
  if (predBody) predBody.innerHTML = buildTeamStatsTableBody(rightScores, { simplified, withPts });
}

function renderTeamOrderCompareHosts({
  useCompact,
  leftSource,
  rightSource,
  sessionParticipantId,
  withPts,
  officialBody,
  predBody,
  leftGrid,
  rightGrid,
  leftTotal,
  rightTotal,
  syncWrap,
  syncRows,
  syncSubLeft,
  syncSubRight,
  syncTotalLeft,
  syncTotalRight,
  leftSubtitle,
  rightSubtitle,
}) {
  const officialSnapshot = getLiveOfficialGroupSnapshot();
  if (useCompact) {
    const leftGridMeta = buildTeamOrderSingleGridHtml(leftSource, sessionParticipantId, {
      withPts,
      syncHead: true,
      reservePtsCol: withPts,
    });
    const rightGridMeta = buildTeamOrderSingleGridHtml(rightSource, sessionParticipantId, {
      withPts,
      syncHead: true,
      reservePtsCol: withPts,
    });
    if (syncWrap) syncWrap.hidden = true;
    if (syncRows) syncRows.innerHTML = "";
    if (leftGrid) {
      leftGrid.innerHTML = leftGridMeta.html;
      leftGrid.hidden = false;
    }
    if (rightGrid) {
      rightGrid.innerHTML = rightGridMeta.html;
      rightGrid.hidden = false;
    }
    setTeamTablesCompareGrandTotal(leftTotal, leftGridMeta);
    setTeamTablesCompareGrandTotal(rightTotal, rightGridMeta);
    if (officialBody) officialBody.innerHTML = "";
    if (predBody) predBody.innerHTML = "";
    return;
  }
  if (syncWrap) syncWrap.hidden = true;
  if (syncRows) syncRows.innerHTML = "";
  if (leftGrid) {
    leftGrid.innerHTML = "";
    leftGrid.hidden = true;
  }
  if (rightGrid) {
    rightGrid.innerHTML = "";
    rightGrid.hidden = true;
  }
  if (leftTotal) {
    leftTotal.textContent = "";
    leftTotal.hidden = true;
  }
  if (rightTotal) {
    rightTotal.textContent = "";
    rightTotal.hidden = true;
  }
  if (leftSource === "official") {
    if (officialBody) officialBody.innerHTML = buildTeamOrderOfficialTableBody(officialSnapshot, { withPts });
  } else {
    const leftOrder = loadPredictions(leftSource).groupOrder ?? {};
    if (officialBody) {
      officialBody.innerHTML = buildTeamOrderPredTableBody(
        leftOrder,
        officialSnapshot,
        leftSource,
        sessionParticipantId,
        { withPts },
      );
    }
  }
  if (rightSource === "official") {
    if (predBody) predBody.innerHTML = buildTeamOrderOfficialTableBody(officialSnapshot, { withPts });
  } else {
    const rightOrder = loadPredictions(rightSource).groupOrder ?? {};
    if (predBody) {
      predBody.innerHTML = buildTeamOrderPredTableBody(
        rightOrder,
        officialSnapshot,
        rightSource,
        sessionParticipantId,
        { withPts },
      );
    }
  }
}

function setTeamTablesLayoutVisibility(panelId, layout) {
  const isCompare = layout === "compare";
  const prefix = panelId === "team-stats" ? "team-stats" : "team-order";
  const compareEl = $(`#${prefix}-compare`);
  const singleEl = $(`#${prefix}-single`);
  const compareControls = $(`#${prefix}-compare-controls`);
  const singleControls = $(`#${prefix}-single-controls`);
  const panel = $(`#panel-${panelId}`);

  if (compareEl) compareEl.hidden = !isCompare;
  if (singleEl) singleEl.hidden = isCompare;
  if (compareControls) compareControls.hidden = !isCompare;
  if (singleControls) singleControls.hidden = isCompare;

  if (panelId === "team-stats") {
    const compareViewWrap = $("#team-stats-compare-view-wrap");
    if (compareViewWrap) compareViewWrap.hidden = !isCompare || isMobileLayout();
  }

  panel?.classList.toggle("team-tables-panel--compare", isCompare);
  panel?.classList.toggle("team-tables-panel--single", !isCompare);
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

function ensureTeamStatsSinglePtsSelect() {
  const radios = [...document.querySelectorAll('input[name="team-stats-single-pts"]')];
  if (radios.length === 0 || radios[0].dataset.ready === "1") return;
  let saved = localStorage.getItem(TEAM_STATS_SINGLE_PTS_KEY);
  if (!saved) saved = localStorage.getItem(TEAM_STATS_VIEW_KEY);
  const preferred = saved === "without-pts" ? "without-pts" : "with-pts";
  radios.forEach((r) => {
    r.checked = r.value === preferred;
    r.addEventListener("change", () => {
      const checked = document.querySelector('input[name="team-stats-single-pts"]:checked');
      const next = checked?.value === "without-pts" ? "without-pts" : "with-pts";
      localStorage.setItem(TEAM_STATS_SINGLE_PTS_KEY, next);
      redrawTeamStats();
    });
    r.dataset.ready = "1";
  });
}

function ensureTeamStatsCompareViewSelect() {
  const radios = [...document.querySelectorAll('input[name="team-stats-compare-view"]')];
  if (radios.length === 0 || radios[0].dataset.ready === "1") return;
  let saved = localStorage.getItem(TEAM_STATS_COMPARE_VIEW_KEY);
  if (!saved) saved = localStorage.getItem(TEAM_STATS_VIEW_KEY);
  const preferred = saved === "simple" ? "simple" : "full";
  radios.forEach((r) => {
    r.checked = r.value === preferred;
    r.addEventListener("change", () => {
      const checked = document.querySelector('input[name="team-stats-compare-view"]:checked');
      const next = checked?.value === "simple" ? "simple" : "full";
      localStorage.setItem(TEAM_STATS_COMPARE_VIEW_KEY, next);
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
  const single = $("#team-stats-single-source");
  if (!left || !right) return;
  const session = loadSession();
  const html = teamStatsSourceOptionsHtml();
  left.innerHTML = html;
  right.innerHTML = html;
  if (single) single.innerHTML = html;
  refreshTeamStatsSelectValues(session?.participantId ?? "");
  refreshTeamStatsSingleSourceValue(session?.participantId ?? "");
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

function buildTeamOrderOfficialTableBody(officialSnapshot, opts = {}) {
  const { withPts = true } = opts;
  const rows = [];
  const perGroupPossible = MAX_PER_GROUP;
  let totalPossible = 0;
  const dividerCols = withPts ? 3 : 2;
  for (const grp of GROUPS) {
    rows.push(`<tr class="team-stats-divider"><td colspan="${dividerCols}">Grupo ${escapeHtml(grp.id)}</td></tr>`);
    const order = Array.isArray(officialSnapshot.orderByGroup?.[grp.id])
      ? officialSnapshot.orderByGroup[grp.id]
      : [];
    for (let i = 0; i < 4; i++) {
      const t = order[i] ?? "";
      rows.push(`
        <tr>
          <td>${i + 1}</td>
          <td>${t ? teamLabelHtml(t) : '<span class="muted">—</span>'}</td>
          ${withPts ? '<td class="team-order-points-cell"><span class="muted">—</span></td>' : ""}
        </tr>
      `);
    }
    if (withPts) {
      const groupPossible = perGroupPossible;
      totalPossible += perGroupPossible;
      rows.push(`
        <tr class="team-order-total-row">
          <td colspan="2"><strong>Total posible</strong></td>
          <td class="team-order-total-num"><strong>${groupPossible}</strong></td>
        </tr>
      `);
    }
  }
  if (withPts) {
    rows.push(`
      <tr class="team-order-total-row team-order-total-row--final">
        <td colspan="2"><strong>Total posible</strong></td>
        <td class="team-order-total-num"><strong>${totalPossible}</strong></td>
      </tr>
    `);
  }
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

function buildTeamOrderPredTableBody(orderByGroup, officialSnapshot, participantId, sessionParticipantId, opts = {}) {
  const { withPts = true } = opts;
  const rows = [];
  const pStore = loadPredictions(participantId);
  let grandTotal = 0;
  const dividerCols = withPts ? 3 : 2;

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
    if (withPts) {
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
    }

    rows.push(
      withPts
        ? `<tr class="team-stats-divider"><td colspan="${dividerCols}"><div class="team-order-group-head"><span>Grupo ${escapeHtml(grp.id)}</span>${groupBadge}</div></td></tr>`
        : `<tr class="team-stats-divider"><td colspan="${dividerCols}">Grupo ${escapeHtml(grp.id)}</td></tr>`,
    );

    for (let i = 0; i < 4; i++) {
      const t = predOrder[i] ?? "";
      let ptsCell = "";
      if (withPts) {
        const hitExact =
          hasOfficialData && Boolean(t) && Boolean(officialOrder[i]) && t === officialOrder[i];
        const rowBasePts =
          hasOfficialData && i < 2 && Boolean(t) && officialQualifiers.has(t)
            ? 1
            : hitExact && i >= 2
              ? 1
              : 0;
        const rowBonusPts =
          hitExact && hasUniquePickBonus(voteCountsByPos[i], t) ? 1 : 0;
        const rowPts = rowBasePts + rowBonusPts;
        ptsCell = `<td class="team-order-points-cell">${pointsBadgeHtml(rowPts, {
          bonus: rowBonusPts > 0,
          title:
            rowBonusPts > 0
              ? rowBasePts > 0
                ? "Acierto en posición con bono por minoría (+1 base +1 bono)"
                : "Acierto en posición con bono por minoría (+1 bono)"
              : rowBasePts > 0 && i >= 2
                ? "Posición exacta acertada (+1)"
                : "Clasificado directo acertado (+1)",
        }) || '<span class="muted">—</span>'}</td>`;
      }
      rows.push(`
        <tr>
          <td>${i + 1}</td>
          <td>${t ? teamLabelHtml(t) : '<span class="muted">—</span>'}</td>
          ${ptsCell}
        </tr>
      `);
    }

    if (withPts) {
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
  }

  if (withPts) {
    rows.push(`
      <tr class="team-order-total-row team-order-total-row--final">
        <td colspan="2"><strong>Total final</strong></td>
        <td class="team-order-total-num"><strong>${grandTotal}</strong></td>
      </tr>
    `);
  }
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
  const single = $("#team-order-single-source");
  if (!left || !right) return;
  const session = loadSession();
  const html = teamOrderSourceOptionsHtml();
  left.innerHTML = html;
  right.innerHTML = html;
  if (single) single.innerHTML = html;
  refreshTeamOrderSelectValues(session?.participantId ?? "");
  refreshTeamOrderSingleSourceValue(session?.participantId ?? "");
}

function redrawTeamStats() {
  const intro = $("#team-stats-intro");
  const loginHint = $("#team-stats-intro-login");
  const officialBody = $("#table-team-stats-official-body");
  const predBody = $("#table-team-stats-pred-body");
  const officialSub = $("#team-stats-subtitle-official");
  const predSub = $("#team-stats-subtitle-pred");
  const compareWrap = $("#team-stats-compare");
  const singleGrid = $("#team-stats-single-grid");
  const singleSub = $("#team-stats-single-subtitle");
  const singlePanel = $("#team-stats-single")?.querySelector(".team-tables-single-panel");
  const panel = $("#panel-team-stats");
  const session = loadSession();

  if (!intro || !officialBody || !predBody) return;

  ensureTeamStatsLayoutSelect();
  const layout = getTeamTablesLayoutValue("team-stats-layout", TEAM_STATS_LAYOUT_KEY);
  localStorage.setItem(TEAM_STATS_LAYOUT_KEY, layout);
  setTeamTablesLayoutVisibility("team-stats", layout);

  if (!session) {
    if (loginHint) loginHint.hidden = false;
    officialBody.innerHTML = "";
    predBody.innerHTML = "";
    if (singleGrid) singleGrid.innerHTML = "";
    const leftCompareGrid = $("#team-stats-compare-left-grid");
    const rightCompareGrid = $("#team-stats-compare-right-grid");
    if (leftCompareGrid) {
      leftCompareGrid.innerHTML = "";
      leftCompareGrid.hidden = true;
    }
    if (rightCompareGrid) {
      rightCompareGrid.innerHTML = "";
      rightCompareGrid.hidden = true;
    }
    const statsCompareSync = $("#team-stats-compare-sync");
    const statsCompareSyncRows = $("#team-stats-compare-sync-rows");
    if (statsCompareSync) statsCompareSync.hidden = true;
    if (statsCompareSyncRows) statsCompareSyncRows.innerHTML = "";
    if (officialSub) officialSub.textContent = "Fase de grupos · Resultado oficial";
    if (predSub) predSub.textContent = "Fase de grupos · Predicción";
    if (singleSub) singleSub.textContent = "Fase de grupos";
    compareWrap?.classList.remove("team-stats-compare--self-selected");
    panel?.classList.remove("team-tables-compare--compact");
    return;
  }

  if (loginHint) loginHint.hidden = true;

  ensureTeamStatsSourceSelects();
  ensureTeamStatsSingleSelect();
  ensureTeamStatsSinglePtsSelect();
  ensureTeamStatsCompareViewSelect();
  refreshTeamStatsSelectValues(session.participantId);
  refreshTeamStatsSingleSourceValue(session.participantId);

  const officialScores = getOfficialConfirmedGroupScores();

  if (layout === "single") {
    const singleSel = $("#team-stats-single-source");
    const singleSource = singleSel?.value ?? session.participantId;
    const withPts = getTeamStatsWithPtsPreference();
    localStorage.setItem(TEAM_STATS_SINGLE_SOURCE_KEY, singleSource);
    localStorage.setItem(TEAM_STATS_SINGLE_PTS_KEY, withPts ? "with-pts" : "without-pts");
    const scores =
      singleSource === "official"
        ? officialScores
        : (loadPredictions(singleSource).groupScores ?? {});
    officialBody.innerHTML = "";
    predBody.innerHTML = "";
    if (singleGrid) singleGrid.innerHTML = buildTeamStatsSingleGridHtml(scores, { withPts });
    if (singleSub) {
      singleSub.textContent = teamStatsSourceSubtitle(singleSource, session.participantId);
      singleSub.classList.toggle(
        "team-stats-subtitle--foreign",
        singleSource !== "official" && singleSource !== session.participantId,
      );
    }
    panel?.classList.remove("team-stats--simple", "team-tables-compare--compact");
    panel?.classList.toggle("team-stats-single--without-pts", !withPts);
    applyTeamTablesSinglePanelTone(singlePanel, singleSource, session.participantId);
    syncGroupPtsBadgeCanvases(singleGrid ?? document.body);
    return;
  }

  const leftSel = $("#team-stats-left-source");
  const rightSel = $("#team-stats-right-source");
  if (singleGrid) singleGrid.innerHTML = "";
  panel?.classList.remove("team-stats-single--without-pts", "team-stats-compare--without-pts");
  const leftSource = leftSel?.value ?? "official";
  const rightSource = rightSel?.value ?? session.participantId;
  localStorage.setItem(TEAM_STATS_LEFT_SOURCE_KEY, leftSource);
  localStorage.setItem(TEAM_STATS_RIGHT_SOURCE_KEY, rightSource);
  const isSelfSelected = rightSource === session.participantId;
  compareWrap?.classList.toggle("team-stats-compare--self-selected", isSelfSelected);

  const leftScores = leftSource === "official" ? officialScores : (loadPredictions(leftSource).groupScores ?? {});
  const rightScores =
    rightSource === "official" ? officialScores : (loadPredictions(rightSource).groupScores ?? {});

  const withPts = getTeamStatsWithPtsPreference();
  localStorage.setItem(TEAM_STATS_SINGLE_PTS_KEY, withPts ? "with-pts" : "without-pts");
  const simplified = getTeamStatsCompareSimplified();
  localStorage.setItem(TEAM_STATS_COMPARE_VIEW_KEY, simplified ? "simple" : "full");
  panel?.classList.toggle("team-stats--simple", simplified);
  panel?.classList.toggle("team-stats-compare--without-pts", !withPts);
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
  const useCompactCompare = isMobileLayout();
  syncTeamTablesCompareCompactClass(panel, useCompactCompare);
  const leftSubtitleText = teamStatsSourceSubtitle(leftSource, session.participantId);
  const rightSubtitleText = teamStatsSourceSubtitle(rightSource, session.participantId);
  renderTeamStatsCompareHosts({
    useCompact: useCompactCompare,
    leftScores,
    rightScores,
    simplified,
    withPts,
    officialBody,
    predBody,
    leftGrid: $("#team-stats-compare-left-grid"),
    rightGrid: $("#team-stats-compare-right-grid"),
    syncWrap: $("#team-stats-compare-sync"),
    syncRows: $("#team-stats-compare-sync-rows"),
    syncSubLeft: $("#team-stats-sync-subtitle-left"),
    syncSubRight: $("#team-stats-sync-subtitle-right"),
    leftSubtitle: leftSubtitleText,
    rightSubtitle: rightSubtitleText,
  });
  applyTeamStatsColumnTone(officialBody, leftSource, session.participantId);
  applyTeamStatsColumnTone(predBody, rightSource, session.participantId);
  syncGroupPtsBadgeCanvases(compareWrap ?? document.body);
}

function redrawTeamOrder() {
  const officialBody = $("#table-team-order-official-body");
  const predBody = $("#table-team-order-pred-body");
  const officialSub = $("#team-order-subtitle-official");
  const predSub = $("#team-order-subtitle-pred");
  const compareWrap = $("#team-order-compare");
  const singleGrid = $("#team-order-single-grid");
  const singleSub = $("#team-order-single-subtitle");
  const singleGrandTotal = $("#team-order-single-grand-total");
  const singlePanel = $("#team-order-single")?.querySelector(".team-tables-single-panel");
  const session = loadSession();

  if (!officialBody || !predBody) return;

  ensureTeamOrderLayoutSelect();
  const layout = getTeamTablesLayoutValue("team-order-layout", TEAM_ORDER_LAYOUT_KEY);
  localStorage.setItem(TEAM_ORDER_LAYOUT_KEY, layout);
  setTeamTablesLayoutVisibility("team-order", layout);

  if (!session) {
    officialBody.innerHTML = "";
    predBody.innerHTML = "";
    if (singleGrid) singleGrid.innerHTML = "";
    const leftCompareGrid = $("#team-order-compare-left-grid");
    const rightCompareGrid = $("#team-order-compare-right-grid");
    if (leftCompareGrid) {
      leftCompareGrid.innerHTML = "";
      leftCompareGrid.hidden = true;
    }
    if (rightCompareGrid) {
      rightCompareGrid.innerHTML = "";
      rightCompareGrid.hidden = true;
    }
    if (singleGrandTotal) {
      singleGrandTotal.textContent = "";
      singleGrandTotal.hidden = true;
    }
    const leftCompareTotal = $("#team-order-compare-left-total");
    const rightCompareTotal = $("#team-order-compare-right-total");
    if (leftCompareTotal) {
      leftCompareTotal.textContent = "";
      leftCompareTotal.hidden = true;
    }
    if (rightCompareTotal) {
      rightCompareTotal.textContent = "";
      rightCompareTotal.hidden = true;
    }
    const orderCompareSync = $("#team-order-compare-sync");
    const orderCompareSyncRows = $("#team-order-compare-sync-rows");
    if (orderCompareSync) orderCompareSync.hidden = true;
    if (orderCompareSyncRows) orderCompareSyncRows.innerHTML = "";
    const orderSyncTotalLeft = $("#team-order-sync-total-left");
    const orderSyncTotalRight = $("#team-order-sync-total-right");
    if (orderSyncTotalLeft) {
      orderSyncTotalLeft.textContent = "";
      orderSyncTotalLeft.hidden = true;
    }
    if (orderSyncTotalRight) {
      orderSyncTotalRight.textContent = "";
      orderSyncTotalRight.hidden = true;
    }
    if (officialSub) officialSub.textContent = "Fase de grupos · Orden oficial";
    if (predSub) predSub.textContent = "Fase de grupos · Orden";
    if (singleSub) singleSub.textContent = "Fase de grupos";
    compareWrap?.classList.remove("team-stats-compare--self-selected");
    $("#panel-team-order")?.classList.remove("team-tables-compare--compact");
    return;
  }

  ensureTeamOrderSourceSelects();
  ensureTeamOrderSingleSelect();
  ensureTeamOrderSinglePtsSelect();
  refreshTeamOrderSelectValues(session.participantId);
  refreshTeamOrderSingleSourceValue(session.participantId);

  if (layout === "single") {
    const singleSel = $("#team-order-single-source");
    const singleSource = singleSel?.value ?? session.participantId;
    const withPts = getTeamOrderWithPtsPreference();
    localStorage.setItem(TEAM_ORDER_SINGLE_SOURCE_KEY, singleSource);
    localStorage.setItem(TEAM_ORDER_SINGLE_PTS_KEY, withPts ? "with-pts" : "without-pts");
    officialBody.innerHTML = "";
    predBody.innerHTML = "";
    const grid = buildTeamOrderSingleGridHtml(singleSource, session.participantId, { withPts });
    if (singleGrid) singleGrid.innerHTML = grid.html;
    if (singleSub) {
      singleSub.textContent = teamOrderSourceSubtitle(singleSource, "left", session.participantId);
      singleSub.classList.toggle(
        "team-stats-subtitle--foreign",
        singleSource !== "official" && singleSource !== session.participantId,
      );
    }
    if (singleGrandTotal) {
      if (grid.showGrandTotal) {
        singleGrandTotal.hidden = false;
        singleGrandTotal.innerHTML = `<strong>${escapeHtml(grid.grandTotalLabel)}:</strong> <strong>${grid.grandTotal}</strong>`;
      } else {
        singleGrandTotal.textContent = "";
        singleGrandTotal.hidden = true;
      }
    }
    $("#panel-team-order")?.classList.remove("team-tables-compare--compact");
    $("#panel-team-order")?.classList.toggle("team-order-single--without-pts", !withPts);
    applyTeamTablesSinglePanelTone(singlePanel, singleSource, session.participantId);
    syncGroupPtsBadgeCanvases(singleGrid ?? document.body);
    return;
  }

  const leftSel = $("#team-order-left-source");
  const rightSel = $("#team-order-right-source");
  const leftSource = leftSel?.value ?? "official";
  const rightSource = rightSel?.value ?? session.participantId;
  const orderPanel = $("#panel-team-order");
  orderPanel?.classList.remove("team-order-single--without-pts", "team-order-compare--without-pts");
  if (singleGrid) singleGrid.innerHTML = "";
  if (singleGrandTotal) {
    singleGrandTotal.textContent = "";
    singleGrandTotal.hidden = true;
  }
  localStorage.setItem(TEAM_ORDER_LEFT_SOURCE_KEY, leftSource);
  localStorage.setItem(TEAM_ORDER_RIGHT_SOURCE_KEY, rightSource);
  const isSelfSelected = rightSource === session.participantId;
  compareWrap?.classList.toggle("team-stats-compare--self-selected", isSelfSelected);

  const leftSubtitleText = teamOrderSourceSubtitle(leftSource, "left", session.participantId);
  const rightSubtitleText = teamOrderSourceSubtitle(rightSource, "right", session.participantId);
  const withPts = getTeamOrderWithPtsPreference();
  localStorage.setItem(TEAM_ORDER_SINGLE_PTS_KEY, withPts ? "with-pts" : "without-pts");
  const useCompactCompare = isMobileLayout();
  syncTeamTablesCompareCompactClass(orderPanel, useCompactCompare);
  orderPanel?.classList.toggle("team-order-compare--without-pts", !withPts);
  renderTeamOrderCompareHosts({
    useCompact: useCompactCompare,
    leftSource,
    rightSource,
    sessionParticipantId: session.participantId,
    withPts,
    officialBody,
    predBody,
    leftGrid: $("#team-order-compare-left-grid"),
    rightGrid: $("#team-order-compare-right-grid"),
    leftTotal: $("#team-order-compare-left-total"),
    rightTotal: $("#team-order-compare-right-total"),
    syncWrap: $("#team-order-compare-sync"),
    syncRows: $("#team-order-compare-sync-rows"),
    syncSubLeft: $("#team-order-sync-subtitle-left"),
    syncSubRight: $("#team-order-sync-subtitle-right"),
    syncTotalLeft: $("#team-order-sync-total-left"),
    syncTotalRight: $("#team-order-sync-total-right"),
    leftSubtitle: leftSubtitleText,
    rightSubtitle: rightSubtitleText,
  });
  applyTeamOrderColumnTone(officialBody, leftSource, session.participantId);
  applyTeamOrderColumnTone(predBody, rightSource, session.participantId);
  syncGroupPtsBadgeCanvases(compareWrap ?? document.body);

  if (officialSub) {
    officialSub.textContent = leftSubtitleText;
    officialSub.classList.toggle("team-stats-subtitle--foreign", leftSource !== "official" && leftSource !== session.participantId);
  }
  if (predSub) {
    predSub.textContent = rightSubtitleText;
    predSub.classList.toggle("team-stats-subtitle--foreign", rightSource !== "official" && rightSource !== session.participantId);
  }
}

/**
 * Celda numérica del ranking de orden de grupos.
 * @param {number} count
 * @param {string} title
 * @param {boolean} isTopInColumn
 * @param {"bien"|"excelente"|"perfecto"|"bonus"|"cercania"} kind
 */
function groupOrderRankingStatCell(count, title, isTopInColumn, kind) {
  const topCls = isTopInColumn ? `group-ranking-stat--top group-ranking-stat--top-${kind}` : "";
  return `<td class="group-ranking-stat ${topCls}" title="${escapeHtml(title)}"><span class="group-ranking-stat-num">${count}</span></td>`;
}

function buildGroupOrderRankingRows(sessionParticipantId) {
  const officialSnapshot = getLiveOfficialGroupSnapshot();
  const participantsForRanking = isArenaMode()
    ? getParticipantsForListDisplay(sessionParticipantId)
    : getParticipantsForDisplay();
  const rows = participantsForRanking.map((p) => {
    const pStore = loadPredictions(p.id);
    let bienCount = 0;
    let excelenteCount = 0;
    let perfectoBonusCount = 0;
    let bonusCount = 0;
    let closestCount = 0;
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
    return { participant: p, bienCount, excelenteCount, perfectoBonusCount, bonusCount, closestCount, totalPoints };
  });

  rows.sort(compareRankingRows);

  const maxBien = Math.max(0, ...rows.map((r) => r.bienCount));
  const maxExcelente = Math.max(0, ...rows.map((r) => r.excelenteCount));
  const maxPerfecto = Math.max(0, ...rows.map((r) => r.perfectoBonusCount));
  const maxBonus = Math.max(0, ...rows.map((r) => r.bonusCount));
  const maxClosest = Math.max(0, ...rows.map((r) => r.closestCount));
  const maxPts = Math.max(0, ...rows.map((r) => r.totalPoints));
  const displayRows = orderRankingRowsForDisplay(rows, sessionParticipantId);

  return displayRows
    .map((r) => {
      const isSelf = r.participant.id === sessionParticipantId;
      const podium =
        r.displayRank === 1
          ? "group-ranking-row--gold"
          : r.displayRank === 2
            ? "group-ranking-row--silver"
            : r.displayRank === 3
              ? "group-ranking-row--bronze"
              : "";
      const rowCls = ["group-ranking-row", podium, isSelf ? "row-self" : ""].filter(Boolean).join(" ");
      const you = isSelf ? ' <span class="td-muted">(tú)</span>' : "";
      return `<tr class="${rowCls}">
        <td class="group-ranking-rank">${r.displayRank}</td>
        <th scope="row" class="group-ranking-name">${escapeHtml(r.participant.name)}${you}</th>
        ${groupOrderRankingStatCell(
          r.bienCount,
          "BIEN: grupos con 1.º y 2.º en orden exacto (+1).",
          maxBien > 0 && r.bienCount === maxBien,
          "bien",
        )}
        ${groupOrderRankingStatCell(
          r.excelenteCount,
          "EXCELENTE: grupos con orden 1.º a 4.º exacto (+2, total badge +3).",
          maxExcelente > 0 && r.excelenteCount === maxExcelente,
          "excelente",
        )}
        ${groupOrderRankingStatCell(
          r.perfectoBonusCount,
          "PERFECTO: grupos con orden completo y acierto de si el 3.º pasa (+1, total badge +4).",
          maxPerfecto > 0 && r.perfectoBonusCount === maxPerfecto,
          "perfecto",
        )}
        ${groupOrderRankingStatCell(
          r.bonusCount,
          "BONO: aciertos en posición con pick minoritario (+1 c/u).",
          maxBonus > 0 && r.bonusCount === maxBonus,
          "bonus",
        )}
        ${groupOrderRankingStatCell(
          r.closestCount,
          "CERCANÍA: solo aplica en partidos (no en orden de grupos).",
          maxClosest > 0 && r.closestCount === maxClosest,
          "cercania",
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

/** Arena: actualiza rankings/stats sin reemplazar formularios de predicción. */
function refreshArenaRemoteLight() {
  const session = loadSession();
  syncArenaTruncationHints();
  updateSessionBar(session);
  renderStats(session);
  renderFloatingRanking(session);
  if (session) {
    updatePredictionTabsProgress(session, loadPredictions(session.participantId));
  }
  const tab = getActiveTabId();
  if (tab === "team-stats") {
    redrawTeamStats();
    rebuildTeamStatsSelectOptions();
  }
  if (tab === "team-order") {
    redrawTeamOrder();
    rebuildTeamOrderSelectOptions();
  }
  if (tab === "team-order-ranking") redrawTeamOrderRanking();
  if (tab === "match-ranking") redrawMatchRanking();
  if (tab === "match-history") redrawMatchHistory();
  if (tab === "final-ranking") renderFinalRanking(session);
}

function hasOpenGroupOrderPicker() {
  return [...document.querySelectorAll(".group-order-combobox__list")].some(
    (list) => list instanceof HTMLElement && !list.hidden,
  );
}

function shouldDeferArenaPredictionRefresh() {
  return isArenaInteractionPaused() || hasOpenGroupOrderPicker();
}

/** Arena: refresco de bloqueos (kickoff / fecha tope) cuando el usuario no está interactuando. */
function refreshArenaPanelsIfIdle() {
  if (shouldDeferArenaPredictionRefresh()) {
    scheduleArenaDeferredRefresh(refreshArenaPanelsIfIdle);
    return;
  }
  refreshArenaRemoteLight();
  const session = loadSession();
  if (!session) return;
  const tab = getActiveTabId();
  const predictions = loadPredictions(session.participantId);
  const official = loadOfficialResults();
  if (tab === "generales") renderGenerales(session.participantId, predictions, false);
  else if (tab === "grupos") renderGrupos(session.participantId, predictions);
  else if (tab === "brackets") renderBrackets(session.participantId, predictions);
  else if (tab === "partidos") renderQuiniela(session, official);
}

/**
 * @param {{ participantId: string } | null} session
 * @param {{ skipPartidosRender?: boolean, preserveScroll?: boolean, onlyActivePanel?: boolean, deferGlobalRankings?: boolean }} [opts]
 */
function refreshAll(session, opts = {}) {
  const {
    skipPartidosRender = false,
    preserveScroll = false,
    onlyActivePanel = false,
    deferGlobalRankings = false,
  } = opts;
  if (isArenaMode()) syncArenaTruncationHints();
  applyKickoffAutoStarts();
  const activeTab = getActiveTabId();
  const showPanel = (panelId) => !onlyActivePanel || activeTab === panelId;
  const partidosWrap = $("#quiniela-wrap");
  const partidosHadFocusAnchor =
    preserveScroll && activeTab === "partidos" && capturePartidosInteractionAnchor(partidosWrap);
  const scrollAnchor = preserveScroll && !partidosHadFocusAnchor ? captureWindowScrollAnchor() : null;

  if (session) {
    const p = getParticipantById(session.participantId);
    if (
      !isArenaMode() &&
      p &&
      p.pin != null &&
      p.pin !== "" &&
      !isPinVerified(p.id, p.pin)
    ) {
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
  syncParticipantSearchInputs();
  if (deferGlobalRankings) {
    scheduleDeferredGlobalRankingsRefresh(session);
  } else {
    runGlobalRankingsRefresh(session);
  }
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
    const predsRoot = $("#match-history-preds-root");
    if (predsRoot) predsRoot.innerHTML = "";
    $("#match-history-totals").textContent = "";
    applyMatchHistoryViewVisibility(getMatchHistoryView());
    $("#table-final-ranking-body").innerHTML = "";
    renderFinalRanking(null);
    redrawMatchRanking();
    renderQuiniela(null, loadOfficialResults());
    updateProximosNavShortcutButton(null);
    updatePredictionTabsProgress(null, null);
    syncGroupPtsBadgeCanvases(document.body);
    scheduleKickoffAutoStartRefresh(
      isArenaMode()
        ? () => scheduleArenaDeferredRefresh(refreshArenaPanelsIfIdle)
        : () => refreshAll(loadSession(), { preserveScroll: true, onlyActivePanel: true }),
    );
    return;
  }
  const predictions = loadPredictions(session.participantId);
  updatePredictionTabsProgress(session, predictions);
  if (showPanel("generales")) {
    renderGenerales(session.participantId, predictions, false);
    markPanelContentReady("generales");
  }
  if (showPanel("grupos")) {
    renderGrupos(session.participantId, predictions);
    markPanelContentReady("grupos");
  }
  if (showPanel("brackets")) {
    renderBrackets(session.participantId, predictions);
    markPanelContentReady("brackets");
  }
  if (showPanel("team-stats")) {
    redrawTeamStats();
    rebuildTeamStatsSelectOptions();
    markPanelContentReady("team-stats");
  }
  if (showPanel("team-order")) {
    redrawTeamOrder();
    rebuildTeamOrderSelectOptions();
    markPanelContentReady("team-order");
  }
  if (showPanel("team-order-ranking")) {
    redrawTeamOrderRanking();
    markPanelContentReady("team-order-ranking");
  }
  if (showPanel("match-ranking")) {
    redrawMatchRanking();
    markPanelContentReady("match-ranking");
  }
  if (showPanel("match-history")) {
    redrawMatchHistory();
    markPanelContentReady("match-history");
  }
  if (showPanel("final-ranking")) {
    renderFinalRanking(session);
    markPanelContentReady("final-ranking");
  }
  if (showPanel("partidos") && !skipPartidosRender && !shouldMutePartidosFullRender()) {
    renderQuiniela(session, loadOfficialResults());
    markPanelContentReady("partidos");
  }
  if (showPanel("stats")) {
    renderStats(session);
    markPanelContentReady("stats");
  }
  updateProximosNavShortcutButton(session);
  const canvasRoot = onlyActivePanel ? (getActivePanelElement() ?? document.body) : document.body;
  requestAnimationFrame(() => syncGroupPtsBadgeCanvases(canvasRoot));
  if (scrollAnchor) restoreWindowScrollAnchor(scrollAnchor);
  const onTimedLockRefresh = isArenaMode()
    ? () => scheduleArenaDeferredRefresh(refreshArenaPanelsIfIdle)
    : () => refreshAll(loadSession(), { preserveScroll: true, onlyActivePanel: true });
  scheduleKickoffAutoStartRefresh(onTimedLockRefresh);
  scheduleArenaGeneralesDeadlineRefresh(onTimedLockRefresh);
  if (!arenaDeadlineCountdownOpen()) {
    document.querySelectorAll("[data-arena-deadline-countdown]").forEach((el) => el.remove());
    if (arenaDeadlineCountdownInterval != null) {
      window.clearInterval(arenaDeadlineCountdownInterval);
      arenaDeadlineCountdownInterval = null;
    }
  }
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
  initParticipantSearch(() => {
    const session = loadSession();
    if (!session) return;
    refreshArenaPredictionTablesForActiveTab(session);
  });
  ensureFaseGruposFilter();
  tabsController = initTabs((tabId) => {
    flushDeferredGlobalRankingsRefresh();
    syncDrawerExpandableSubmenus(tabId);
    const sess = loadSession();
    requestAnimationFrame(() => {
      if (!sess || isPanelContentReady(tabId)) return;
      refreshAll(sess, { onlyActivePanel: true, preserveScroll: true, deferGlobalRankings: true });
    });
  });
  initDrawerExpandableSubmenus(tabsController);
  bindRulesQuickButton();
  ensureMatchHistoryViewSelect();

  if (MOBILE_LAYOUT_MQ) {
    MOBILE_LAYOUT_MQ.addEventListener("change", () => {
      const panelStats = $("#panel-team-stats");
      const panelOrder = $("#panel-team-order");
      if (panelStats && !panelStats.hidden) redrawTeamStats();
      if (panelOrder && !panelOrder.hidden) redrawTeamOrder();
    });
  }

  /** Evita solapar varios refreshAll (WS + pestañas); reentrancia rompe el DOM y bloquea la UI. */
  let externalSyncRefreshChain = Promise.resolve();

  function queueRefreshAfterExternalSync() {
    if (isArenaMode()) {
      scheduleArenaDeferredRefresh(refreshArenaPanelsIfIdle);
      return;
    }
    externalSyncRefreshChain = externalSyncRefreshChain
      .then(() => {
        invalidateAllPanelContent();
        refreshAll(loadSession(), {
          preserveScroll: true,
          onlyActivePanel: true,
          deferGlobalRankings: true,
        });
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

  window.addEventListener("pm26-arena-rankings", () => {
    if (!isArenaMode()) return;
    refreshArenaRemoteLight();
  });

  function afterSessionReady() {
    refreshAll(loadSession(), { onlyActivePanel: true, deferGlobalRankings: true });
  }

  window.addEventListener("pm26-pin-stale", () => {
    if (isArenaMode()) return;
    showOnboarding(afterSessionReady);
  });

  bindAdminSettings(afterSessionReady);
  bindArenaAccountSettings();
  bindParticipantAccentPopover();

  bindSessionChange(() => {
    if (isArenaMode()) return;
    showOnboarding(afterSessionReady);
    refreshAll(null);
  });

  if (isArenaMode()) {
    const sess = loadSession();
    if (sess && getParticipantById(sess.participantId)) {
      afterSessionReady();
    } else {
      location.href = "/ArenaMundial/login/";
    }
  } else {
    let s = loadSession();
    if (s && getParticipantById(s.participantId)) {
      afterSessionReady();
    } else {
      clearSession();
      showOnboarding(afterSessionReady);
      refreshAll(null);
    }
  }

  requestAnimationFrame(() => syncGroupPtsBadgeCanvases(getActivePanelElement() ?? document.body));

  MOBILE_LAYOUT_MQ?.addEventListener?.("change", () => {
    syncGeneralesPredsTableMobileColumns($("#generales-preds-host"));
  });
}
