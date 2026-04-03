/**
 * Almacenamiento de predicciones por participante (memoria y opcionalmente servidor).
 */

import { isRemoteSyncActive } from "./remote-sync-flags.js";
import { pushPredictions, deleteRemotePredictions } from "./sync-push.js";

/** @typedef {ReturnType<typeof emptyPredictions>} Predictions */

let useRemotePredictions = false;
/** @type {Record<string, Predictions>} */
let predictionsRemoteMap = {};
/** @type {Record<string, Predictions>} */
let predictionsLocalMap = {};

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
    /** @type {boolean} predicciones generales confirmadas por el usuario */
    generalConfirmed: false,
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
    generalConfirmed: d.generalConfirmed === true,
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
  return normalizePredictionsData(predictionsLocalMap[participantId]);
}

/** @param {Record<string, unknown>} [map] */
export function hydratePredictionsFromRemote(map) {
  useRemotePredictions = true;
  predictionsRemoteMap = {};
  const src = map && typeof map === "object" ? map : {};
  for (const [id, raw] of Object.entries(src)) {
    predictionsRemoteMap[id] = normalizePredictionsData(raw);
  }
}

export function disableRemotePredictions() {
  useRemotePredictions = false;
  predictionsLocalMap = { ...predictionsRemoteMap };
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
  if (useRemotePredictions) {
    predictionsRemoteMap[participantId] = next;
    if (isRemoteSyncActive()) {
      pushPredictions(participantId, next).catch((e) => console.error("[pm26 sync]", e));
    }
  } else {
    predictionsLocalMap[participantId] = next;
  }
  return next;
}

/** Borra las predicciones guardadas de un participante. */
export function deletePredictionsStorage(participantId) {
  if (useRemotePredictions) {
    delete predictionsRemoteMap[participantId];
    if (isRemoteSyncActive()) {
      deleteRemotePredictions(participantId).catch((e) => console.error("[pm26 sync]", e));
    }
    return;
  }
  delete predictionsLocalMap[participantId];
}

/**
 * Elimina todas las claves `pm26-predictions:*` del localStorage del navegador.
 * No borra sesión ni resultados oficiales.
 */
export function clearAllParticipantsPredictions() {
  if (useRemotePredictions) {
    predictionsRemoteMap = {};
  } else {
    predictionsLocalMap = {};
  }
}
