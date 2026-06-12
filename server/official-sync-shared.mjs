import { normalizeOfficialResultsData } from "../src/official-results-store.js";

/** @returns {number} ms epoch; SQLite sin zona se trata como UTC */
export function parseOfficialUpdatedAt(value) {
  const s = String(value ?? "").trim();
  if (!s) return 0;
  if (s.includes("T")) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? 0 : t;
  }
  const t = Date.parse(s.replace(" ", "T") + "Z");
  return Number.isNaN(t) ? 0 : t;
}

/** @returns {-1 | 0 | 1} negativo si a es más antiguo que b */
export function compareOfficialUpdatedAt(a, b) {
  const ta = parseOfficialUpdatedAt(a);
  const tb = parseOfficialUpdatedAt(b);
  if (ta === tb) return 0;
  return ta > tb ? 1 : -1;
}

/** @param {unknown} a @param {unknown} b */
export function officialPayloadEqual(a, b) {
  return (
    JSON.stringify(normalizeOfficialResultsData(a)) ===
    JSON.stringify(normalizeOfficialResultsData(b))
  );
}

/** @param {unknown} official */
export function normalizeOfficialPayload(official) {
  return normalizeOfficialResultsData(official);
}

/** @type {Record<string, number>} */
const STAGE_RANK = { ready: 0, started: 1, finished: 2 };

/** @param {unknown} stage */
function stageRank(stage) {
  return STAGE_RANK[String(stage ?? "ready")] ?? 0;
}

/**
 * Por partido, conserva el estado más avanzado (finished > started > ready).
 * @param {ReturnType<typeof normalizeOfficialPayload>} local
 * @param {ReturnType<typeof normalizeOfficialPayload>} remote
 * @param {string} id
 */
function pickGroupMatchSlice(local, remote, id) {
  const ls = local.groupMatchState?.[id] ?? "ready";
  const rs = remote.groupMatchState?.[id] ?? "ready";
  const lr = stageRank(ls);
  const rr = stageRank(rs);
  if (rr > lr) {
    return {
      state: rs,
      score: remote.groupScores?.[id] ?? local.groupScores?.[id],
      confirmed: remote.groupScoresConfirmed?.[id] === true,
    };
  }
  if (lr > rr) {
    return {
      state: ls,
      score: local.groupScores?.[id] ?? remote.groupScores?.[id],
      confirmed: local.groupScoresConfirmed?.[id] === true,
    };
  }
  const lc = local.groupScoresConfirmed?.[id] === true;
  const rc = remote.groupScoresConfirmed?.[id] === true;
  const score =
    rc && remote.groupScores?.[id]
      ? remote.groupScores[id]
      : lc && local.groupScores?.[id]
        ? local.groupScores[id]
        : remote.groupScores?.[id] ?? local.groupScores?.[id];
  return {
    state: ls,
    score,
    confirmed: lc || rc,
  };
}

/** @param {ReturnType<typeof normalizeOfficialPayload>} local @param {ReturnType<typeof normalizeOfficialPayload>} remote @param {string} id */
function pickKnockoutMatchSlice(local, remote, id) {
  const ls = local.knockoutMatchState?.[id] ?? "ready";
  const rs = remote.knockoutMatchState?.[id] ?? "ready";
  const lr = stageRank(ls);
  const rr = stageRank(rs);
  if (rr > lr) {
    return {
      state: rs,
      score: remote.knockoutScores?.[id] ?? local.knockoutScores?.[id],
      confirmed: remote.knockoutScoresConfirmed?.[id] === true,
    };
  }
  if (lr > rr) {
    return {
      state: ls,
      score: local.knockoutScores?.[id] ?? remote.knockoutScores?.[id],
      confirmed: local.knockoutScoresConfirmed?.[id] === true,
    };
  }
  const lc = local.knockoutScoresConfirmed?.[id] === true;
  const rc = remote.knockoutScoresConfirmed?.[id] === true;
  const score =
    rc && remote.knockoutScores?.[id]
      ? remote.knockoutScores[id]
      : lc && local.knockoutScores?.[id]
        ? local.knockoutScores[id]
        : remote.knockoutScores?.[id] ?? local.knockoutScores?.[id];
  return {
    state: ls,
    score,
    confirmed: lc || rc,
  };
}

/**
 * Une dos snapshots oficiales sin perder partidos terminados en ningún lado.
 * @param {unknown} localRaw
 * @param {unknown} remoteRaw
 */
export function mergeOfficialPreferAdvanced(localRaw, remoteRaw) {
  const local = normalizeOfficialPayload(localRaw);
  const remote = normalizeOfficialPayload(remoteRaw);
  const out = normalizeOfficialPayload(local);

  const groupIds = new Set([
    ...Object.keys(local.groupMatchState ?? {}),
    ...Object.keys(remote.groupMatchState ?? {}),
    ...Object.keys(local.groupScores ?? {}),
    ...Object.keys(remote.groupScores ?? {}),
  ]);
  for (const id of groupIds) {
    const pick = pickGroupMatchSlice(local, remote, id);
    if (pick.state === "ready" && !pick.score) {
      delete out.groupMatchState[id];
      delete out.groupScores[id];
      delete out.groupScoresConfirmed[id];
      continue;
    }
    if (pick.state !== "ready") out.groupMatchState[id] = pick.state;
    if (pick.score) out.groupScores[id] = pick.score;
    if (pick.confirmed) out.groupScoresConfirmed[id] = true;
    else delete out.groupScoresConfirmed[id];
  }

  const koIds = new Set([
    ...Object.keys(local.knockoutMatchState ?? {}),
    ...Object.keys(remote.knockoutMatchState ?? {}),
    ...Object.keys(local.knockoutScores ?? {}),
    ...Object.keys(remote.knockoutScores ?? {}),
  ]);
  for (const id of koIds) {
    const pick = pickKnockoutMatchSlice(local, remote, id);
    if (pick.state === "ready" && !pick.score) {
      delete out.knockoutMatchState[id];
      delete out.knockoutScores[id];
      delete out.knockoutScoresConfirmed[id];
      continue;
    }
    if (pick.state !== "ready") out.knockoutMatchState[id] = pick.state;
    if (pick.score) out.knockoutScores[id] = pick.score;
    if (pick.confirmed) out.knockoutScoresConfirmed[id] = true;
    else delete out.knockoutScoresConfirmed[id];
  }

  if (remote.generalOfficialConfirmed && !local.generalOfficialConfirmed) {
    out.generalOfficial = { ...local.generalOfficial, ...remote.generalOfficial };
    out.generalOfficialConfirmed = true;
  }
  if (remote.groupPredictionsBlockedForAll || local.groupPredictionsBlockedForAll) {
    out.groupPredictionsBlockedForAll =
      remote.groupPredictionsBlockedForAll || local.groupPredictionsBlockedForAll;
  }
  if (remote.generalPredictionsBlockedForParticipants || local.generalPredictionsBlockedForParticipants) {
    out.generalPredictionsBlockedForParticipants =
      remote.generalPredictionsBlockedForParticipants || local.generalPredictionsBlockedForParticipants;
  }

  return normalizeOfficialPayload(out);
}

/** @param {unknown} local @param {string|null|undefined} localAt @param {unknown} remote @param {string|null|undefined} remoteAt */
export function reconcileOfficialForSync(local, localAt, remote, remoteAt) {
  const cmp = compareOfficialUpdatedAt(remoteAt, localAt);
  /** El snapshot más reciente gana (incluye reiniciar/desconfirmar). Empate → unión conservando lo más avanzado. */
  const merged =
    cmp > 0
      ? normalizeOfficialPayload(remote)
      : cmp < 0
        ? normalizeOfficialPayload(local)
        : mergeOfficialPreferAdvanced(local, remote);
  if (officialPayloadEqual(local, merged)) {
    return { changed: false, merged, updatedAt: localAt ?? remoteAt ?? null };
  }
  const winnerAt =
    cmp > 0
      ? (remoteAt ?? new Date().toISOString())
      : cmp < 0
        ? (localAt ?? new Date().toISOString())
        : compareOfficialUpdatedAt(remoteAt, localAt) >= 0
          ? (remoteAt ?? localAt ?? new Date().toISOString())
          : (localAt ?? remoteAt ?? new Date().toISOString());
  return {
    changed: true,
    merged,
    updatedAt: winnerAt ?? new Date().toISOString(),
  };
}
