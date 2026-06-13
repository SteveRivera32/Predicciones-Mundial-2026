/**
 * Sincroniza resultados oficiales de Arena hacia la quiniela privada y viceversa.
 */

import { syncSecretHeaders } from "../../server/sync-secret.mjs";
import {
  compareOfficialUpdatedAt,
  officialPayloadEqual,
  normalizeOfficialPayload,
  reconcileOfficialForSync,
} from "../../server/official-sync-shared.mjs";
import {
  getOfficialResults,
  setOfficialResultsWithUpdatedAt,
} from "./db.mjs";

const DEFAULT_PRIVADAS_PUSH_URL = "http://127.0.0.1:8787/api/internal/sync-official";

let applyingFromPrivadas = false;

export function isApplyingOfficialFromPrivadas() {
  return applyingFromPrivadas;
}

/** @param {unknown} official @param {string | null | undefined} updatedAt */
export async function pushOfficialToPrivadas(official, updatedAt) {
  const url = process.env.ARENA_PRIVADAS_OFFICIAL_PUSH_URL ?? DEFAULT_PRIVADAS_PUSH_URL;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...syncSecretHeaders() },
      body: JSON.stringify({
        official: normalizeOfficialPayload(official),
        updatedAt: updatedAt ?? new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn("[arena] push official → privadas: HTTP", res.status);
    }
  } catch (e) {
    console.warn("[arena] push official → privadas:", e instanceof Error ? e.message : e);
  }
}

/**
 * Guarda resultado oficial local y lo empuja a privadas si el cambio es local.
 * @param {unknown} data
 * @param {{ fromPrivadas?: boolean, updatedAt?: string | null }} [opts]
 */
export function saveArenaOfficial(data, opts = {}) {
  const normalized = normalizeOfficialPayload(data);
  const at = opts.fromPrivadas ? opts.updatedAt : new Date().toISOString();
  const saved = setOfficialResultsWithUpdatedAt(normalized, at);
  if (!opts.fromPrivadas && !applyingFromPrivadas) {
    void pushOfficialToPrivadas(saved.data, saved.updatedAt);
  }
  return saved;
}

/**
 * Aplica official de privadas si es más reciente.
 * @param {unknown} official
 * @param {string | null | undefined} updatedAt
 * @param {() => void} [onChanged]
 */
export function applyOfficialFromPrivadasIfNewer(official, updatedAt, onChanged) {
  if (!official || typeof official !== "object") return false;
  const current = getOfficialResults();
  const { changed, merged, updatedAt: at } = reconcileOfficialForSync(
    current.data,
    current.updatedAt,
    official,
    updatedAt,
  );
  if (!changed) {
    if (!officialPayloadEqual(merged, official)) {
      void pushOfficialToPrivadas(merged, current.updatedAt ?? at ?? new Date().toISOString());
    }
    return false;
  }

  applyingFromPrivadas = true;
  try {
    saveArenaOfficial(merged, { fromPrivadas: true, updatedAt: String(at ?? new Date().toISOString()) });
    if (!officialPayloadEqual(merged, official)) {
      void pushOfficialToPrivadas(merged, at ?? new Date().toISOString());
    }
    onChanged?.();
  } finally {
    applyingFromPrivadas = false;
  }
  return true;
}
