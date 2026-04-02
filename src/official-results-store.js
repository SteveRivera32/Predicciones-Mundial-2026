/**
 * Resultados oficiales (reales) — localStorage y opcionalmente servidor compartido.
 * Editable solo en la UI si `canEditOfficialResults(session)`.
 */

import { isRemoteSyncActive } from "./remote-sync-flags.js";
import { pushOfficial } from "./sync-push.js";

const STORAGE_KEY = "pm26-official-results";

let officialRemoteMode = false;
/** @type {ReturnType<typeof emptyOfficialResults> | null} */
let officialRemoteCache = null;

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
  };
}

/**
 * @returns {ReturnType<typeof emptyOfficialResults>}
 */
export function loadOfficialResults() {
  if (officialRemoteMode && officialRemoteCache) {
    return normalizeOfficialResultsData(officialRemoteCache);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyOfficialResults();
    return normalizeOfficialResultsData(JSON.parse(raw));
  } catch {
    return emptyOfficialResults();
  }
}

/** @param {unknown} data */
export function hydrateOfficialFromRemote(data) {
  officialRemoteMode = true;
  officialRemoteCache = normalizeOfficialResultsData(data);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(officialRemoteCache));
  } catch {
    /* ignore */
  }
}

export function disableRemoteOfficial() {
  officialRemoteMode = false;
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
    knockoutScores:
      patch.knockoutScores === undefined
        ? prev.knockoutScores
        : { ...prev.knockoutScores, ...patch.knockoutScores },
    knockoutScoresConfirmed:
      patch.knockoutScoresConfirmed === undefined
        ? prev.knockoutScoresConfirmed
        : { ...prev.knockoutScoresConfirmed, ...patch.knockoutScoresConfirmed },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  if (officialRemoteMode) {
    officialRemoteCache = next;
    if (isRemoteSyncActive()) {
      pushOfficial(next).catch((e) => console.error("[pm26 sync]", e));
    }
  }
  return next;
}

/** Quita por completo los resultados oficiales de este navegador (quiniela, grupos, podio admin, bloqueos). */
export function clearOfficialResultsStorage() {
  localStorage.removeItem(STORAGE_KEY);
  if (officialRemoteMode) {
    officialRemoteCache = emptyOfficialResults();
  }
}
