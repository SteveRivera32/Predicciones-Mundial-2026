/**
 * Avisa a Arena para que vuelque predicciones de la quiniela privada.
 */

import { syncSecretHeaders } from "./sync-secret.mjs";

const DEFAULT_TRIGGER_URL = "http://127.0.0.1:8788/api/arena/internal/sync-privadas";

export function notifyArenaPrivadasSync() {
  const url = process.env.PM26_ARENA_SYNC_TRIGGER_URL ?? DEFAULT_TRIGGER_URL;
  return fetch(url, { method: "POST", headers: syncSecretHeaders() }).catch(() => {});
}
