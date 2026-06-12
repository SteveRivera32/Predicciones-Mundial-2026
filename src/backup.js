/**
 * Exportación e importación de copias de seguridad (participantes, predicciones, resultados oficiales).
 * Los puntos se recalculan al restaurar; no hace falta guardarlos.
 */

import { getParticipants, setParticipantsList } from "./participants.js";
import { getAllPredictionsMap, replacePredictionsState, prunePredictionsToParticipantIds } from "./predictions-store.js";
import { loadOfficialResults, replaceOfficialState } from "./official-results-store.js";
import { isRemoteSyncActive } from "./remote-sync-flags.js";
import { applyRemoteState } from "./sync.js";
import { pushFullState, pushOfficial, pushParticipants, pushPredictions } from "./sync-push.js";

export const BACKUP_VERSION = 1;

/**
 * @returns {{ participants: unknown[]; official: object; predictions: Record<string, object> }}
 */
export function collectCurrentState() {
  return {
    participants: getParticipants(),
    official: loadOfficialResults(),
    predictions: getAllPredictionsMap(),
  };
}

/**
 * @param {unknown} raw
 * @returns {{ participants: unknown[]; official: object; predictions: Record<string, object> } | null}
 */
export function extractStateFromBackup(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const data = obj.data && typeof obj.data === "object" ? obj.data : obj;
  const d = /** @type {Record<string, unknown>} */ (data);
  if (
    !Array.isArray(d.participants) ||
    !d.official ||
    typeof d.official !== "object" ||
    !d.predictions ||
    typeof d.predictions !== "object"
  ) {
    return null;
  }
  return {
    participants: d.participants,
    official: /** @type {object} */ (d.official),
    predictions: /** @type {Record<string, object>} */ (d.predictions),
  };
}

/**
 * @param {{ participants: unknown[]; official: object; predictions: Record<string, object> }} state
 */
export function buildBackupEnvelope(state) {
  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "pm26",
    data: state,
  };
}

/**
 * @param {{ participants: unknown[]; official: object; predictions: Record<string, object> }} [state]
 */
export function downloadBackupFile(state = collectCurrentState()) {
  const envelope = buildBackupEnvelope(state);
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `pm26-backup-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Aplica estado en memoria local (sin empujar al servidor).
 * @param {{ participants: unknown[]; official: object; predictions: Record<string, object> }} state
 */
export function applyFullStateLocally(state) {
  setParticipantsList(state.participants);
  replaceOfficialState(state.official);
  replacePredictionsState(state.predictions);
  prunePredictionsToParticipantIds(getParticipants().map((p) => p.id));
}

/**
 * Empuja cada bloque al servidor (fallback si PUT /api/state no existe).
 * @param {{ participants: unknown[]; official: object; predictions: Record<string, object> }} state
 */
async function pushStatePiecemeal(state) {
  const resP = await pushParticipants(state.participants);
  if (!resP.ok) throw new Error("participants");
  const resO = await pushOfficial(state.official);
  if (!resO.ok) throw new Error("official");
  for (const [id, preds] of Object.entries(state.predictions)) {
    const res = await pushPredictions(id, preds);
    if (!res.ok) throw new Error(`predictions:${id}`);
  }
}

/**
 * Restaura estado completo; con servidor activo también lo persiste allí.
 * @param {{ participants: unknown[]; official: object; predictions: Record<string, object> }} state
 */
export async function restoreFullState(state) {
  if (isRemoteSyncActive()) {
    let res = await pushFullState(state);
    if (res.ok) {
      const body = await res.json();
      applyRemoteState(body.data ?? state);
      return;
    }
    if (res.status === 404 || res.status === 405) {
      await pushStatePiecemeal(state);
      applyRemoteState(state);
      return;
    }
    throw new Error(String(res.status));
  }
  applyFullStateLocally(state);
}

/**
 * @param {unknown} raw
 */
export async function restoreFromBackupFile(raw) {
  const state = extractStateFromBackup(raw);
  if (!state) throw new Error("invalid");
  await restoreFullState(state);
}
