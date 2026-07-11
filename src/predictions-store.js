/**
 * Almacenamiento de predicciones por participante (memoria y opcionalmente servidor).
 */

import { isRemoteSyncActive } from "./remote-sync-flags.js";
import {
  isArenaMode,
  getArenaUserId,
  pushArenaMyPredictions,
  isArenaPrivadasMirrorUser,
} from "./arena-mode.js";
import { migrateStoredTeamNames } from "./tournament.js";
import { cloneScoreMap, mergeScoreMapCloned } from "./match-score-clone.js";
import { mergePredictionsPreferAdvanced } from "./predictions-merge.js";
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
  const d = /** @type {Record<string, unknown>} */ (migrateStoredTeamNames(data));
  const base = emptyPredictions();
  const {
    groupScores: _gs,
    knockoutScores: _kos,
    general: _gen,
    groupOrder: _go,
    groupOrderConfirmed: _goc,
    groupThirdAdvances: _gta,
    groupScoresConfirmed: _gsc,
    knockoutScoresConfirmed: _kosc,
    ...dRest
  } = d;
  return {
    ...base,
    ...dRest,
    general: { ...base.general, ...(d.general ?? {}) },
    generalConfirmed: d.generalConfirmed === true,
    groupOrder: { ...base.groupOrder, ...(d.groupOrder ?? {}) },
    groupOrderConfirmed: { ...base.groupOrderConfirmed, ...(d.groupOrderConfirmed ?? {}) },
    groupThirdAdvances: { ...base.groupThirdAdvances, ...(d.groupThirdAdvances ?? {}) },
    groupScores: cloneScoreMap(d.groupScores),
    groupScoresConfirmed: { ...base.groupScoresConfirmed, ...(d.groupScoresConfirmed ?? {}) },
    knockoutScores: cloneScoreMap(d.knockoutScores),
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

/** En Arena solo conservamos predicciones cargadas (vista previa, búsqueda o las propias). */
/** @type {Set<string>} */
let arenaLoadedParticipantIds = new Set();
/** IDs cargados por búsqueda remota; no se podan en el sync periódico. */
/** @type {Set<string>} */
let arenaPinnedParticipantIds = new Set();

/**
 * Predicciones enviadas al servidor pero aún no reflejadas en el estado remoto recibido.
 * Evita que un WS/poll con estado viejo borre cambios locales (condición de carrera).
 * @type {Map<string, Predictions>}
 */
const pendingPushByParticipant = new Map();

/** @param {Predictions} data */
function predictionsFingerprint(data) {
  try {
    return JSON.stringify(data);
  } catch {
    return "";
  }
}

/** Tras hidratar desde remoto, conserva pendientes hasta que el servidor coincida. */
function reconcilePendingPushOnHydrate() {
  for (const [id, pending] of pendingPushByParticipant) {
    const remote = predictionsRemoteMap[id];
    if (predictionsFingerprint(remote) === predictionsFingerprint(pending)) {
      pendingPushByParticipant.delete(id);
    } else {
      predictionsRemoteMap[id] = pending;
    }
  }
}

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pushRetryTimers = new Map();

function queuePrivadasPredictionsPush(participantId, data) {
  pendingPushByParticipant.set(participantId, data);
  const existingTimer = pushRetryTimers.get(participantId);
  if (existingTimer != null) window.clearTimeout(existingTimer);
  return pushPredictions(participantId, data)
    .then((res) => {
      if (!res.ok) throw new Error(`push failed ${res.status}`);
    })
    .catch((e) => {
      console.error("[pm26 sync]", e);
      const timer = window.setTimeout(() => {
        pushRetryTimers.delete(participantId);
        const latest = pendingPushByParticipant.get(participantId);
        if (latest) void queuePrivadasPredictionsPush(participantId, latest);
      }, 4000);
      pushRetryTimers.set(participantId, timer);
    });
}

function pruneArenaPredictionsCache() {
  if (!isArenaMode()) return;
  for (const id of Object.keys(predictionsRemoteMap)) {
    if (!arenaLoadedParticipantIds.has(id) && !arenaPinnedParticipantIds.has(id)) {
      delete predictionsRemoteMap[id];
    }
  }
}

/** @param {Iterable<string>} ids */
export function resetArenaLoadedPredictionIds(ids) {
  arenaLoadedParticipantIds = new Set(ids);
  for (const id of arenaPinnedParticipantIds) arenaLoadedParticipantIds.add(id);
  pruneArenaPredictionsCache();
}

/** Conserva predicciones de búsqueda Arena entre ciclos de sync. */
export function pinArenaPredictionsFromSearch(map) {
  arenaPinnedParticipantIds = new Set(Object.keys(map && typeof map === "object" ? map : {}));
  mergePredictionsFromRemote(map);
}

/** Al limpiar la búsqueda, deja de fijar esos participantes en caché. */
export function clearArenaPinnedPredictionIds() {
  if (arenaPinnedParticipantIds.size === 0) return;
  arenaPinnedParticipantIds.clear();
  pruneArenaPredictionsCache();
}

/** @param {Record<string, unknown>} [map] */
export function mergePredictionsFromRemote(map) {
  useRemotePredictions = true;
  const src = map && typeof map === "object" ? map : {};
  for (const [id, raw] of Object.entries(src)) {
    predictionsRemoteMap[id] = normalizePredictionsData(raw);
    if (isArenaMode()) arenaLoadedParticipantIds.add(id);
  }
  if (isArenaMode()) pruneArenaPredictionsCache();
}

/** @param {Record<string, unknown>} [map] */
export function hydratePredictionsFromRemote(map) {
  if (isArenaMode()) {
    const arenaUserId = getArenaUserId();
    /** Solo conservar en memoria si ya había predicciones cargadas (p. ej. cambios locales pendientes de sync). */
    const hadLocalMine =
      Boolean(arenaUserId) &&
      !isArenaPrivadasMirrorUser() &&
      Object.prototype.hasOwnProperty.call(predictionsRemoteMap, arenaUserId);
    const keepMineRemote = hadLocalMine
      ? normalizePredictionsData(predictionsRemoteMap[arenaUserId])
      : null;
    const src = map && typeof map === "object" ? map : {};
    /** @type {string[]} */
    const ids = Object.keys(src);
    if (arenaUserId && hadLocalMine && !src[arenaUserId]) {
      ids.push(arenaUserId);
    }
    resetArenaLoadedPredictionIds(ids);
    mergePredictionsFromRemote(src);
    if (arenaUserId && hadLocalMine && keepMineRemote) {
      predictionsRemoteMap[arenaUserId] = keepMineRemote;
      arenaLoadedParticipantIds.add(arenaUserId);
    }
    return;
  }
  useRemotePredictions = true;
  const prevMap = { ...predictionsRemoteMap };
  predictionsRemoteMap = {};
  const src = map && typeof map === "object" ? map : {};
  for (const [id, raw] of Object.entries(src)) {
    const prev = prevMap[id];
    if (pendingPushByParticipant.has(id) || prev == null) {
      predictionsRemoteMap[id] = normalizePredictionsData(raw);
    } else {
      predictionsRemoteMap[id] = mergePredictionsPreferAdvanced(prev, raw);
    }
  }
  reconcilePendingPushOnHydrate();
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
  if (isArenaMode() && isArenaPrivadasMirrorUser()) {
    return loadPredictions(participantId);
  }
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
    groupScores: mergeScoreMapCloned(prev.groupScores, patch.groupScores),
    knockoutScores: mergeScoreMapCloned(prev.knockoutScores, patch.knockoutScores),
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
    if (isArenaMode()) {
      arenaLoadedParticipantIds.add(participantId);
      if (participantId === getArenaUserId()) {
        pushArenaMyPredictions(next).catch((e) => console.error("[arena sync]", e));
      }
    } else if (isRemoteSyncActive()) {
      void queuePrivadasPredictionsPush(participantId, next);
    }
  } else {
    predictionsLocalMap[participantId] = next;
  }
  return next;
}

/**
 * Elimina predicciones de participantes que ya no están en la quiniela.
 * @param {Iterable<string>} validParticipantIds
 */
export function prunePredictionsToParticipantIds(validParticipantIds) {
  const valid = new Set(validParticipantIds);
  const map = useRemotePredictions ? predictionsRemoteMap : predictionsLocalMap;
  for (const id of Object.keys(map)) {
    if (valid.has(id)) continue;
    delete map[id];
    if (useRemotePredictions && isRemoteSyncActive()) {
      deleteRemotePredictions(id).catch((e) => console.error("[pm26 sync]", e));
    }
  }
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

/** Mapa completo de predicciones (para exportar backup). */
export function getAllPredictionsMap() {
  const map = useRemotePredictions ? predictionsRemoteMap : predictionsLocalMap;
  /** @type {Record<string, Predictions>} */
  const out = {};
  for (const [id, raw] of Object.entries(map)) {
    out[id] = normalizePredictionsData(raw);
  }
  return out;
}

/** Sustituye todas las predicciones (restauración desde backup). */
export function replacePredictionsState(map) {
  /** @type {Record<string, Predictions>} */
  const next = {};
  const src = map && typeof map === "object" ? map : {};
  for (const [id, raw] of Object.entries(src)) {
    next[id] = normalizePredictionsData(raw);
  }
  if (useRemotePredictions) {
    predictionsRemoteMap = next;
  } else {
    predictionsLocalMap = next;
  }
}
