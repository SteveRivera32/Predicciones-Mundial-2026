/**
 * Resultados oficiales de Arena (solo local; no se sincronizan con privadas).
 */

import { normalizeOfficialPayload } from "../../server/official-sync-shared.mjs";
import { setOfficialResultsWithUpdatedAt } from "./db.mjs";

/**
 * Guarda resultado oficial en la base de Arena.
 * @param {unknown} data
 * @param {{ updatedAt?: string | null }} [opts]
 */
export function saveArenaOfficial(data, opts = {}) {
  const normalized = normalizeOfficialPayload(data);
  const at = opts.updatedAt ?? new Date().toISOString();
  return setOfficialResultsWithUpdatedAt(normalized, at);
}

/** @deprecated Los estados oficiales ya no se comparten con privadas. */
export function applyOfficialFromPrivadasIfNewer(_official, _updatedAt, _onChanged) {
  return false;
}
