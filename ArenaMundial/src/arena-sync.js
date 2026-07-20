import { applyRemoteOfficialOnly, applyRemoteState } from "@shared/sync.js";

import { setArenaServerRankings, setArenaMatchVoteData, setArenaRankingsBundle, switchArenaRankingAudience, hasArenaRankingsBundle } from "@shared/arena-mode.js";

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

/** El bootstrap ya hizo sync lite; evita repetirlo al iniciar el poll. */

let bootLiteSyncDone = false;



export function markArenaBootLiteSyncDone() {

  bootLiteSyncDone = true;

}



export async function pullArenaSync(opts = {}) {

  const lite = Boolean(opts.lite);

  const data = await apiFetch(lite ? "/sync?lite=1" : "/sync");

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

  if (data.matchVoteData) setArenaMatchVoteData(data.matchVoteData);

  /* applyRemoteState ya emite pm26-remote-sync cuando hay cambios */

}



/** Rankings + recuentos de votos (un solo cálculo pesado en servidor, cacheado). */

export async function pullArenaRankings() {

  try {

    const data = await apiFetch("/rankings");

    setArenaRankingsBundle(data);

    window.dispatchEvent(new CustomEvent("pm26-arena-rankings"));

  } catch {

    /* reintentar en el próximo ciclo */

  }

}



/**

 * Resultados oficiales. `lite` omite matchVoteData (respuesta rápida; útil en poll frecuente).

 * @param {{ lite?: boolean }} [opts]

 */

export async function pullArenaOfficialSync(opts = {}) {

  const lite = Boolean(opts.lite);

  const data = await apiFetch(lite ? "/official?lite=1" : "/official");

  let fp;

  try {

    fp = JSON.stringify(data);

  } catch {

    return;

  }

  if (fp === lastOfficialFingerprint) return;

  lastOfficialFingerprint = fp;

  if (data?.official) applyRemoteOfficialOnly(data.official);

  if (data?.matchVoteData) setArenaMatchVoteData(data.matchVoteData);

}



const RANKINGS_SYNC_MS = Math.max(

  5000,

  Number(import.meta.env.VITE_ARENA_RANKINGS_SYNC_MS || 8000),

);



/** Rankings, votos y vista previa de predicciones — no bloquean la UI inicial. */

export function pullArenaBackgroundEnrich() {

  void pullArenaRankings().catch(() => {});

  void pullArenaSync().catch(() => {});

}



export async function initArenaSyncPoll() {

  if (!bootLiteSyncDone) {

    await pullArenaSync({ lite: true }).catch(() => {});

  }

  bootLiteSyncDone = false;

  await pullArenaOfficialSync({ lite: true }).catch(() => {});

  pullArenaBackgroundEnrich();

  if (fullPollTimer != null) return;

  fullPollTimer = window.setInterval(() => {

    if (document.hidden) return;

    void pullArenaSync().catch(() => {});

  }, FULL_SYNC_MS);

  officialPollTimer = window.setInterval(() => {

    if (document.hidden) return;

    void pullArenaOfficialSync({ lite: true }).catch(() => {});

  }, OFFICIAL_SYNC_MS);

  window.setInterval(() => {

    if (document.hidden) return;

    void pullArenaRankings().catch(() => {});

  }, RANKINGS_SYNC_MS);

  document.addEventListener("visibilitychange", () => {

    if (document.hidden) return;

    void pullArenaSync().catch(() => {});

    void pullArenaOfficialSync({ lite: true }).catch(() => {});

    void pullArenaRankings().catch(() => {});

  });

  window.addEventListener("pm26-arena-local-official-saved", () => {
    lastOfficialFingerprint = "";
    lastFingerprint = "";
    void pullArenaOfficialSync({ lite: true }).catch(() => {});
    void pullArenaRankings().catch(() => {});
  });
}

