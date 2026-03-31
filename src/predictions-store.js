/**
 * Almacenamiento de predicciones por participante (localStorage y opcionalmente servidor).
 */

import { isRemoteSyncActive } from "./remote-sync-flags.js";
import { pushPredictions, deleteRemotePredictions } from "./sync-push.js";

/** @typedef {ReturnType<typeof emptyPredictions>} Predictions */

function storeKey(participantId) {
  return `pm26-predictions:${participantId}`;
}

let useRemotePredictions = false;
/** @type {Record<string, Predictions>} */
let predictionsRemoteMap = {};

export function emptyPredictions() {
  return {
    general: {
      first: "",
      second: "",
      third: "",
      bestPlayer: "",
      bestGk: "",
      topScorer: "",
    },
    groupOrder: {},
    /** @type {Record<string, boolean>} grupo -> orden confirmado por usuario */
    groupOrderConfirmed: {},
    /** @type {Record<string, boolean>} grupo → ¿el 3.º predicho pasa como mejor tercero? */
    groupThirdAdvances: {},
    groupScores: {},
    /** @type {Record<string, true>} partido de grupo → marcador predicho confirmado por el usuario */
    groupScoresConfirmed: {},
    knockoutScores: {},
    /** @type {Record<string, true>} */
    knockoutScoresConfirmed: {},
  };
}

/**
 * @param {unknown} data
 * @returns {Predictions}
 */
export function normalizePredictionsData(data) {
  if (!data || typeof data !== "object") return emptyPredictions();
  const d = data;
  const base = emptyPredictions();
  return {
    ...base,
    ...d,
    general: { ...base.general, ...(d.general ?? {}) },
    groupOrderConfirmed: { ...base.groupOrderConfirmed, ...(d.groupOrderConfirmed ?? {}) },
    groupThirdAdvances: { ...base.groupThirdAdvances, ...(d.groupThirdAdvances ?? {}) },
    groupScoresConfirmed: { ...base.groupScoresConfirmed, ...(d.groupScoresConfirmed ?? {}) },
    knockoutScoresConfirmed: {
      ...base.knockoutScoresConfirmed,
      ...(d.knockoutScoresConfirmed ?? {}),
    },
  };
}

/**
 * @param {string} participantId
 * @returns {Predictions}
 */
export function loadPredictions(participantId) {
  if (useRemotePredictions) {
    const raw = predictionsRemoteMap[participantId];
    return normalizePredictionsData(raw);
  }
  try {
    const raw = localStorage.getItem(storeKey(participantId));
    if (!raw) return emptyPredictions();
    return normalizePredictionsData(JSON.parse(raw));
  } catch {
    return emptyPredictions();
  }
}

/** @param {Record<string, unknown>} [map] */
export function hydratePredictionsFromRemote(map) {
  useRemotePredictions = true;
  predictionsRemoteMap = {};
  const src = map && typeof map === "object" ? map : {};
  for (const [id, raw] of Object.entries(src)) {
    predictionsRemoteMap[id] = normalizePredictionsData(raw);
  }
  const prefix = "pm26-predictions:";
  if (typeof localStorage !== "undefined") {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) localStorage.removeItem(k);
    }
    for (const [id, pred] of Object.entries(predictionsRemoteMap)) {
      localStorage.setItem(storeKey(id), JSON.stringify(pred));
    }
  }
}

export function disableRemotePredictions() {
  useRemotePredictions = false;
  predictionsRemoteMap = {};
}

/**
 * @param {string} participantId
 * @param {Partial<Predictions> & { replaceGroupScoresConfirmed?: boolean; replaceKnockoutScoresConfirmed?: boolean }} patch
 * Si `replaceGroupScoresConfirmed === true`, `groupScoresConfirmed` sustituye al mapa anterior (sirve para quitar claves al desbloquear).
 */
export function savePredictions(participantId, patch) {
  const prev = loadPredictions(participantId);
  const { replaceGroupScoresConfirmed, replaceKnockoutScoresConfirmed, ...patchRest } = patch;
  const prevGsc = prev.groupScoresConfirmed ?? {};
  const next = {
    ...prev,
    ...patchRest,
    general: { ...prev.general, ...(patch.general ?? {}) },
    groupOrder: { ...prev.groupOrder, ...(patch.groupOrder ?? {}) },
    groupOrderConfirmed: { ...prev.groupOrderConfirmed, ...(patch.groupOrderConfirmed ?? {}) },
    groupThirdAdvances: { ...prev.groupThirdAdvances, ...(patch.groupThirdAdvances ?? {}) },
    groupScores: { ...prev.groupScores, ...(patch.groupScores ?? {}) },
    knockoutScores: { ...prev.knockoutScores, ...(patch.knockoutScores ?? {}) },
    knockoutScoresConfirmed:
      patch.knockoutScoresConfirmed === undefined
        ? prev.knockoutScoresConfirmed ?? {}
        : replaceKnockoutScoresConfirmed
          ? { ...patch.knockoutScoresConfirmed }
          : { ...(prev.knockoutScoresConfirmed ?? {}), ...patch.knockoutScoresConfirmed },
    groupScoresConfirmed:
      patch.groupScoresConfirmed === undefined
        ? prevGsc
        : replaceGroupScoresConfirmed
          ? { ...(patch.groupScoresConfirmed ?? {}) }
          : { ...prevGsc, ...patch.groupScoresConfirmed },
  };
  localStorage.setItem(storeKey(participantId), JSON.stringify(next));
  if (useRemotePredictions) {
    predictionsRemoteMap[participantId] = next;
    if (isRemoteSyncActive()) {
      pushPredictions(participantId, next).catch((e) => console.error("[pm26 sync]", e));
    }
  }
  return next;
}

/** Borra las predicciones guardadas de un participante. */
export function deletePredictionsStorage(participantId) {
  localStorage.removeItem(storeKey(participantId));
  if (useRemotePredictions) {
    delete predictionsRemoteMap[participantId];
    if (isRemoteSyncActive()) {
      deleteRemotePredictions(participantId).catch((e) => console.error("[pm26 sync]", e));
    }
  }
}

/**
 * Elimina todas las claves `pm26-predictions:*` del localStorage del navegador.
 * No borra sesión ni resultados oficiales.
 */
export function clearAllParticipantsPredictions() {
  const prefix = "pm26-predictions:";
  if (typeof localStorage !== "undefined") {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) localStorage.removeItem(k);
    }
  }
  if (useRemotePredictions) {
    predictionsRemoteMap = {};
  }
}
