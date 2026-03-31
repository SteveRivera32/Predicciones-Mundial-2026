/**
 * Envío al servidor de sincronización (sin lógica de estado).
 */

export function pushOfficial(data) {
  return fetch("/api/official", {
    method: "PUT",
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
