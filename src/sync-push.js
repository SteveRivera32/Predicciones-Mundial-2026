/**
 * Envío al servidor de sincronización (sin lógica de estado).
 */

export function pushOfficial(data) {
  return fetch("/api/official", {
    method: "PUT",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function pushPredictions(participantId, data) {
  return fetch(`/api/predictions/${encodeURIComponent(participantId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function pushParticipants(list) {
  return fetch("/api/participants", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(list),
  });
}

export function deleteRemotePredictions(participantId) {
  return fetch(`/api/predictions/${encodeURIComponent(participantId)}`, {
    method: "DELETE",
  });
}

/** Reinicia predicciones de todos y resultado oficial en el servidor. */
export function pushResetQuiniela() {
  return fetch("/api/reset-quiniela", { method: "POST" });
}

/** Restaura el estado completo en el servidor. */
export function pushFullState(state) {
  return fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
}

export function fetchBackupsList() {
  return fetch("/api/backups").then((res) => (res.ok ? res.json() : null));
}

export function restoreServerBackup(filename) {
  return fetch(`/api/restore/${encodeURIComponent(filename)}`, { method: "POST" });
}
