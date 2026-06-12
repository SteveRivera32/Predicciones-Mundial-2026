/**
 * Resultados oficiales (reales) — memoria y opcionalmente servidor compartido.
 * Editable solo en la UI si `canEditOfficialResults(session)`.
 */

import { isRemoteSyncActive } from "./remote-sync-flags.js";
import { isArenaMode, isArenaAdmin, pushArenaOfficial } from "./arena-mode.js";
import { migrateStoredTeamNames } from "./tournament.js";
import { pushOfficial } from "./sync-push.js";

const OFFICIAL_STORAGE_KEY_PRIVATE = "pm26-official-results";
const OFFICIAL_STORAGE_KEY_ARENA = "pm26-arena-official-results";

let officialRemoteMode = false;
/** @type {ReturnType<typeof emptyOfficialResults> | null} */
let officialRemoteCache = null;
/** @type {ReturnType<typeof emptyOfficialResults>} */
let officialLocalCache = emptyOfficialResults();
let localStorageHydrated = false;

function officialStorageKey() {
  return isArenaMode() ? OFFICIAL_STORAGE_KEY_ARENA : OFFICIAL_STORAGE_KEY_PRIVATE;
}

/** @returns {ReturnType<typeof emptyOfficialResults> | null} */
function readOfficialFromLocalStorage() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(officialStorageKey());
    if (!raw) return null;
    return normalizeOfficialResultsData(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** @param {ReturnType<typeof emptyOfficialResults>} data */
function writeOfficialToLocalStorage(data) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(officialStorageKey(), JSON.stringify(data));
  } catch {
    /* quota / modo privado */
  }
}

function removeOfficialFromLocalStorage() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(officialStorageKey());
  } catch {
    /* ignore */
  }
}

function ensureLocalCacheHydrated() {
  if (localStorageHydrated) return;
  localStorageHydrated = true;
  const stored = readOfficialFromLocalStorage();
  if (stored) officialLocalCache = stored;
}

/**
 * Conserva partidos terminados del navegador si el servidor aún no los refleja
 * (p. ej. admin confirmó sin API o recarga antes del poll).
 * @param {unknown} serverData
 * @param {ReturnType<typeof emptyOfficialResults>} localData
 */
function mergePersistedFinishedMatches(serverData, localData) {
  const server = normalizeOfficialResultsData(serverData);
  const local = normalizeOfficialResultsData(localData);
  const next = { ...server };

  for (const [id, stage] of Object.entries(local.groupMatchState ?? {})) {
    if (stage !== "finished") continue;
    if ((server.groupMatchState?.[id] ?? "ready") === "finished") continue;
    next.groupMatchState = { ...next.groupMatchState, [id]: "finished" };
    if (local.groupScores?.[id]) {
      next.groupScores = { ...next.groupScores, [id]: local.groupScores[id] };
    }
    if (local.groupScoresConfirmed?.[id]) {
      next.groupScoresConfirmed = { ...next.groupScoresConfirmed, [id]: true };
    }
  }

  for (const [id, stage] of Object.entries(local.knockoutMatchState ?? {})) {
    if (stage !== "finished") continue;
    if ((server.knockoutMatchState?.[id] ?? "ready") === "finished") continue;
    next.knockoutMatchState = { ...next.knockoutMatchState, [id]: "finished" };
    if (local.knockoutScores?.[id]) {
      next.knockoutScores = { ...next.knockoutScores, [id]: local.knockoutScores[id] };
    }
    if (local.knockoutScoresConfirmed?.[id]) {
      next.knockoutScoresConfirmed = { ...next.knockoutScoresConfirmed, [id]: true };
    }
  }

  return next;
}

/** @param {ReturnType<typeof emptyOfficialResults>} next */
function persistOfficialCaches(next) {
  if (officialRemoteMode) {
    officialRemoteCache = next;
  } else {
    officialLocalCache = next;
  }
  writeOfficialToLocalStorage(next);
}

/** Resultado real del podio y premios (solo admin, confirmado cuando se publica). */
function emptyGeneralOfficial() {
  return {
    first: "",
    second: "",
    third: "",
    bestPlayer: "",
    bestGk: "",
    topScorer: "",
  };
}

/**
 * @param {unknown} data
 * @returns {ReturnType<typeof emptyOfficialResults>}
 */
export function normalizeOfficialResultsData(data) {
  if (!data || typeof data !== "object") return emptyOfficialResults();
  data = /** @type {Record<string, unknown>} */ (migrateStoredTeamNames(data));
  const base = emptyOfficialResults();
  let groupScoresConfirmed = {
    ...base.groupScoresConfirmed,
    ...(data.groupScoresConfirmed ?? {}),
  };
  let knockoutScoresConfirmed = {
    ...base.knockoutScoresConfirmed,
    ...(data.knockoutScoresConfirmed ?? {}),
  };
  const gs = { ...base.groupScores, ...(data.groupScores ?? {}) };
  const kos = { ...base.knockoutScores, ...(data.knockoutScores ?? {}) };
  if (data.groupScores && data.groupScoresConfirmed == null) {
    for (const [id, sc] of Object.entries(gs)) {
      if (sc?.home !== "" && sc?.away !== "") groupScoresConfirmed[id] = true;
    }
  }
  if (data.knockoutScores && data.knockoutScoresConfirmed == null) {
    for (const [id, sc] of Object.entries(kos)) {
      if (sc?.home !== "" && sc?.away !== "") knockoutScoresConfirmed[id] = true;
    }
  }
  let knockoutMatchState = { ...base.knockoutMatchState, ...(data.knockoutMatchState ?? {}) };
  if (data.knockoutScores && data.knockoutMatchState == null) {
    for (const [id, sc] of Object.entries(kos)) {
      const hasScore = sc?.home !== "" && sc?.away !== "";
      if (!hasScore) continue;
      knockoutMatchState[id] = knockoutScoresConfirmed[id] === true ? "finished" : "started";
    }
  }
  return {
    ...base,
    ...data,
    groupScores: gs,
    groupScoresConfirmed,
    groupMatchState: { ...base.groupMatchState, ...(data.groupMatchState ?? {}) },
    groupOfficialOrder: { ...base.groupOfficialOrder, ...(data.groupOfficialOrder ?? {}) },
    groupOfficialThirdAdvance: {
      ...base.groupOfficialThirdAdvance,
      ...(data.groupOfficialThirdAdvance ?? {}),
    },
    groupOfficialOrderConfirmed: {
      ...base.groupOfficialOrderConfirmed,
      ...(data.groupOfficialOrderConfirmed ?? {}),
    },
    generalOfficial: {
      ...base.generalOfficial,
      ...(data.generalOfficial ?? {}),
    },
    generalOfficialConfirmed: Boolean(data.generalOfficialConfirmed),
    generalPredictionsBlockedForParticipants: Boolean(
      data.generalPredictionsBlockedForParticipants ?? data.predictionsFrozenForParticipants,
    ),
    groupPredictionsBlockedForAll: Boolean(data.groupPredictionsBlockedForAll),
    knockoutScores: kos,
    knockoutScoresConfirmed,
    knockoutMatchState,
  };
}

export function emptyOfficialResults() {
  return {
    /** @type {Record<string, { home: number | "", away: number | "" }>} */
    groupScores: {},
    /** Solo tras «Confirmar» (admin); hasta entonces el resto ve pendiente y no hay puntos en quiniela. */
    /** @type {Record<string, true>} */
    groupScoresConfirmed: {},
    /** Estado del partido en quiniela: ready | started | finished */
    /** @type {Record<string, "ready" | "started" | "finished">} */
    groupMatchState: {},
    /** Orden real 1.º–4.º por grupo (solo admin). */
    /** @type {Record<string, string[]>} */
    groupOfficialOrder: {},
    /** ¿El 3.º del orden oficial pasa como mejor tercero? */
    /** @type {Record<string, boolean>} */
    groupOfficialThirdAdvance: {},
    /** @type {Record<string, true>} */
    groupOfficialOrderConfirmed: {},
    /** Podio y premios individuales reales. */
    generalOfficial: emptyGeneralOfficial(),
    /** Si es false, la tabla muestra fila «pendiente» y no hay puntos por generales. */
    generalOfficialConfirmed: false,
    /** Pestaña Predicciones generales: participantes no pueden editar; el admin sí. */
    generalPredictionsBlockedForParticipants: false,
    /** Fase de grupos: bloqueo global de predicciones para todos (incluido admin). */
    groupPredictionsBlockedForAll: false,
    /** Marcadores reales de eliminatoria (admin). `penaltyWinner` si el marcador es empate en fases con penales. */
    /** @type {Record<string, { home: number | "", away: number | "", penaltyWinner?: "home" | "away" | "" }>} */
    knockoutScores: {},
    /** Solo tras confirmar por partido (admin); alimenta la columna «Resultado real» en Brackets. */
    /** @type {Record<string, true>} */
    knockoutScoresConfirmed: {},
    /** Estado del partido en eliminatoria: ready | started | finished */
    /** @type {Record<string, "ready" | "started" | "finished">} */
    knockoutMatchState: {},
  };
}

/**
 * @returns {ReturnType<typeof emptyOfficialResults>}
 */
export function loadOfficialResults() {
  if (officialRemoteMode && officialRemoteCache) {
    return normalizeOfficialResultsData(officialRemoteCache);
  }
  ensureLocalCacheHydrated();
  return normalizeOfficialResultsData(officialLocalCache);
}

/** @param {unknown} data */
export function hydrateOfficialFromRemote(data) {
  ensureLocalCacheHydrated();
  const normalized = normalizeOfficialResultsData(data);
  const merged =
    isRemoteSyncActive() || isArenaMode()
      ? normalized
      : mergePersistedFinishedMatches(data, officialLocalCache);
  officialRemoteMode = true;
  officialRemoteCache = merged;
  writeOfficialToLocalStorage(merged);
}

export function disableRemoteOfficial() {
  officialRemoteMode = false;
  if (officialRemoteCache) {
    officialLocalCache = normalizeOfficialResultsData(officialRemoteCache);
    writeOfficialToLocalStorage(officialLocalCache);
  } else {
    ensureLocalCacheHydrated();
  }
  officialRemoteCache = null;
}

/**
 * @param {Partial<ReturnType<typeof emptyOfficialResults>> & { replaceGroupScoresConfirmed?: boolean; replaceGroupOfficialOrderConfirmed?: boolean; replaceGroupMatchState?: boolean }} patch
 * Si `replaceGroupScoresConfirmed === true`, `groupScoresConfirmed` sustituye al mapa anterior (sirve para quitar claves).
 */
export function saveOfficialResults(patch) {
  const prev = loadOfficialResults();
  const {
    replaceGroupScoresConfirmed,
    replaceGroupOfficialOrderConfirmed,
    replaceGroupMatchState,
    ...rest
  } = patch;
  const next = {
    ...prev,
    ...rest,
    groupScores: { ...prev.groupScores, ...(patch.groupScores ?? {}) },
    groupScoresConfirmed:
      patch.groupScoresConfirmed === undefined
        ? prev.groupScoresConfirmed
        : replaceGroupScoresConfirmed
          ? { ...patch.groupScoresConfirmed }
          : { ...prev.groupScoresConfirmed, ...patch.groupScoresConfirmed },
    groupMatchState:
      patch.groupMatchState === undefined
        ? prev.groupMatchState
        : replaceGroupMatchState
          ? { ...patch.groupMatchState }
          : { ...prev.groupMatchState, ...patch.groupMatchState },
    groupOfficialOrder: {
      ...prev.groupOfficialOrder,
      ...(patch.groupOfficialOrder ?? {}),
    },
    groupOfficialThirdAdvance: {
      ...prev.groupOfficialThirdAdvance,
      ...(patch.groupOfficialThirdAdvance ?? {}),
    },
    groupOfficialOrderConfirmed:
      patch.groupOfficialOrderConfirmed === undefined
        ? prev.groupOfficialOrderConfirmed
        : replaceGroupOfficialOrderConfirmed
          ? { ...patch.groupOfficialOrderConfirmed }
          : { ...prev.groupOfficialOrderConfirmed, ...patch.groupOfficialOrderConfirmed },
    generalOfficial:
      patch.generalOfficial === undefined
        ? prev.generalOfficial ?? emptyGeneralOfficial()
        : { ...(prev.generalOfficial ?? emptyGeneralOfficial()), ...patch.generalOfficial },
    generalOfficialConfirmed:
      patch.generalOfficialConfirmed === undefined
        ? prev.generalOfficialConfirmed
        : patch.generalOfficialConfirmed,
    generalPredictionsBlockedForParticipants:
      patch.generalPredictionsBlockedForParticipants === undefined
        ? prev.generalPredictionsBlockedForParticipants
        : patch.generalPredictionsBlockedForParticipants,
    groupPredictionsBlockedForAll:
      patch.groupPredictionsBlockedForAll === undefined
        ? prev.groupPredictionsBlockedForAll
        : patch.groupPredictionsBlockedForAll,
    knockoutMatchState:
      patch.knockoutMatchState === undefined
        ? prev.knockoutMatchState
        : { ...prev.knockoutMatchState, ...patch.knockoutMatchState },
    knockoutScores:
      patch.knockoutScores === undefined
        ? prev.knockoutScores
        : { ...prev.knockoutScores, ...patch.knockoutScores },
    knockoutScoresConfirmed:
      patch.knockoutScoresConfirmed === undefined
        ? prev.knockoutScoresConfirmed
        : { ...prev.knockoutScoresConfirmed, ...patch.knockoutScoresConfirmed },
  };
  persistOfficialCaches(next);
  if (officialRemoteMode) {
    if (isArenaMode()) {
      if (isArenaAdmin()) {
        pushArenaOfficial(next)
          .then(() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("pm26-arena-local-official-saved"));
            }
          })
          .catch((e) => console.error("[arena sync]", e));
      }
    } else if (isRemoteSyncActive()) {
      pushOfficial(next).catch((e) => console.error("[pm26 sync]", e));
    }
  }
  return next;
}

/** Quita por completo los resultados oficiales de este navegador (quiniela, grupos, podio admin, bloqueos). */
export function clearOfficialResultsStorage() {
  const empty = emptyOfficialResults();
  if (officialRemoteMode) {
    officialRemoteCache = empty;
  } else {
    officialLocalCache = empty;
  }
  removeOfficialFromLocalStorage();
}

/** Sustituye resultados oficiales (restauración desde backup). */
export function replaceOfficialState(data) {
  const next = normalizeOfficialResultsData(data);
  persistOfficialCaches(next);
  return next;
}
