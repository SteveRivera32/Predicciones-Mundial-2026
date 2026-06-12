import { applyRemoteOfficialOnly, applyRemoteState } from "@shared/sync.js";
import { apiFetch } from "./api.js";

const FULL_SYNC_MS = Math.max(
  3000,
  Number(import.meta.env.VITE_ARENA_SYNC_MS || 4000),
);
const OFFICIAL_SYNC_MS = Math.max(
  2000,
  Number(import.meta.env.VITE_ARENA_OFFICIAL_SYNC_MS || 3500),
);

let fullPollTimer = null;
let officialPollTimer = null;
let lastFingerprint = "";
let lastOfficialFingerprint = "";

export async function pullArenaSync() {
  const data = await apiFetch("/sync");
  let fp;
  try {
    fp = JSON.stringify(data);
  } catch {
    return;
  }
  if (fp === lastFingerprint) return;
  lastFingerprint = fp;
  try {
    lastOfficialFingerprint = JSON.stringify({
      official: data.official,
      updatedAt: data.officialUpdatedAt ?? null,
    });
  } catch {
    /* ignore */
  }
  applyRemoteState({
    participants: data.participants,
    official: data.official,
    predictions: data.predictions,
  });
  /* applyRemoteState ya emite pm26-remote-sync cuando hay cambios */
}

/** Resultados oficiales (liviano, sin cache en /sync) para reflejar cambios de privadas al instante. */
export async function pullArenaOfficialSync() {
  const data = await apiFetch("/official");
  let fp;
  try {
    fp = JSON.stringify(data);
  } catch {
    return;
  }
  if (fp === lastOfficialFingerprint) return;
  lastOfficialFingerprint = fp;
  if (data?.official) applyRemoteOfficialOnly(data.official);
}

export async function initArenaSyncPoll() {
  await pullArenaSync();
  await pullArenaOfficialSync();
  if (fullPollTimer != null) return;
  fullPollTimer = window.setInterval(() => {
    if (document.hidden) return;
    void pullArenaSync().catch(() => {});
  }, FULL_SYNC_MS);
  officialPollTimer = window.setInterval(() => {
    if (document.hidden) return;
    void pullArenaOfficialSync().catch(() => {});
  }, OFFICIAL_SYNC_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    void pullArenaSync().catch(() => {});
    void pullArenaOfficialSync().catch(() => {});
  });
  window.addEventListener("pm26-arena-local-official-saved", () => {
    lastOfficialFingerprint = "";
    lastFingerprint = "";
  });
}
