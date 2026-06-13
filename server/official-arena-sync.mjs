/**
 * Sincroniza resultados oficiales entre la quiniela privada (state.json) y Arena.
 */

import { syncSecretHeaders } from "./sync-secret.mjs";
import {
  compareOfficialUpdatedAt,
  officialPayloadEqual,
  normalizeOfficialPayload,
  reconcileOfficialForSync,
} from "./official-sync-shared.mjs";

const DEFAULT_ARENA_PUSH_URL = "http://127.0.0.1:8788/api/arena/internal/sync-official";
const DEFAULT_ARENA_PULL_URL = "http://127.0.0.1:8788/api/arena/official";

let applyingFromArena = false;

/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

export function isApplyingOfficialFromArena() {
  return applyingFromArena;
}

/** @template T @param {() => T | Promise<T>} fn */
export async function withApplyingFromArena(fn) {
  applyingFromArena = true;
  try {
    return await fn();
  } finally {
    applyingFromArena = false;
  }
}

/** Empuja a Arena si el snapshot local difiere del remoto recién leído. */
export function pushOfficialToArenaIfDiffers(localMerged, localAt, remoteOfficial) {
  if (!remoteOfficial || typeof remoteOfficial !== "object") return;
  if (officialPayloadEqual(localMerged, remoteOfficial)) return;
  void pushOfficialToArena(localMerged, localAt ?? new Date().toISOString());
}

export async function pushOfficialToArena(official, updatedAt) {
  const url = process.env.PM26_ARENA_OFFICIAL_PUSH_URL ?? DEFAULT_ARENA_PUSH_URL;
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
      console.warn("[pm26] push official → arena: HTTP", res.status);
    }
  } catch (e) {
    console.warn("[pm26] push official → arena:", e instanceof Error ? e.message : e);
  }
}

/**
 * @param {{ official: object, officialUpdatedAt?: string | null }} stateRef
 * @param {(official: object, updatedAt: string) => Promise<void>} apply
 */
export async function pullAndApplyOfficialFromArena(stateRef, apply) {
  const url = process.env.ARENA_OFFICIAL_PULL_URL ?? DEFAULT_ARENA_PULL_URL;
  let payload;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    payload = await res.json();
  } catch (e) {
    console.warn("[pm26] pull official ← arena:", e instanceof Error ? e.message : e);
    return false;
  }

  const official = payload?.official;
  const updatedAt = payload?.updatedAt ?? null;
  if (!official || typeof official !== "object") return false;

  const { changed, merged, updatedAt: at } = reconcileOfficialForSync(
    stateRef.official,
    stateRef.officialUpdatedAt,
    official,
    updatedAt,
  );
  if (!changed) {
    if (at && compareOfficialUpdatedAt(at, stateRef.officialUpdatedAt) > 0) {
      stateRef.officialUpdatedAt = at;
    }
    /** PM ya tiene el estado fusionado pero Arena puede seguir atrás (p. ej. push fallido). */
    pushOfficialToArenaIfDiffers(
      merged,
      stateRef.officialUpdatedAt ?? at,
      official,
    );
    return false;
  }

  applyingFromArena = true;
  try {
    await apply(merged, String(at ?? new Date().toISOString()));
    if (!officialPayloadEqual(merged, official)) {
      void pushOfficialToArena(merged, at ?? new Date().toISOString());
    }
  } finally {
    applyingFromArena = false;
  }
  return true;
}

/**
 * @param {{ official: object, officialUpdatedAt?: string | null }} stateRef
 * @param {(official: object, updatedAt: string) => Promise<void>} apply
 */
export function startOfficialArenaSyncPoll(stateRef, apply) {
  const intervalMs = Math.max(4000, Number(process.env.PM26_OFFICIAL_SYNC_MS || 5000));
  const tick = () => {
    void pullAndApplyOfficialFromArena(stateRef, apply);
  };
  tick();
  if (pollTimer != null) return;
  pollTimer = setInterval(tick, intervalMs);
}
