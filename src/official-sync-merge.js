/**
 * Fusión de snapshots oficiales por partido (cliente y servidor).
 * Sin dependencias de official-results-store para evitar ciclos de import.
 */

/** @type {Record<string, number>} */
const STAGE_RANK = { ready: 0, started: 1, finished: 2 };

/** @param {unknown} stage */
function stageRank(stage) {
  return STAGE_RANK[String(stage ?? "ready")] ?? 0;
}

/** @param {{ home?: unknown, away?: unknown } | undefined} sc */
function scoreIsEmpty(sc) {
  if (!sc) return true;
  return (sc.home === "" || sc.home == null) && (sc.away === "" || sc.away == null);
}

/** Marcador 0-0 del autostart al kickoff (no es desconfirmación manual). */
function isKickoffPlaceholder(sc) {
  if (!sc || scoreIsEmpty(sc)) return false;
  const h = sc.home;
  const a = sc.away;
  return (h === 0 || h === "0") && (a === 0 || a === "0");
}

/** Admin confirmó resultado final en este snapshot. */
function isExplicitMatchFinish(side, id, kind) {
  const stateKey = kind === "group" ? "groupMatchState" : "knockoutMatchState";
  const confirmedKey = kind === "group" ? "groupScoresConfirmed" : "knockoutScoresConfirmed";
  const is = /** @type {Record<string, string>} */ (side[stateKey] ?? {})[id] ?? "ready";
  const ic = /** @type {Record<string, boolean>} */ (side[confirmedKey] ?? {})[id] === true;
  return is === "finished" && ic;
}

/**
 * Admin desconfirmó frente a un baseline ya terminado y confirmado.
 * Un partido «en juego» con marcador (sin clave confirmada=false) NO cuenta: evita que
 * pestañas obsoletas pisen un resultado ya confirmado en otro cliente.
 */
function isExplicitMatchUnconfirm(incoming, baseline, id, kind) {
  if (!isExplicitMatchFinish(baseline, id, kind)) return false;
  const stateKey = kind === "group" ? "groupMatchState" : "knockoutMatchState";
  const confirmedKey = kind === "group" ? "groupScoresConfirmed" : "knockoutScoresConfirmed";
  const scoresKey = kind === "group" ? "groupScores" : "knockoutScores";
  const incomingConfirmed = /** @type {Record<string, boolean>} */ (incoming[confirmedKey] ?? {});
  const is = /** @type {Record<string, string>} */ (incoming[stateKey] ?? {})[id] ?? "ready";
  const sc = /** @type {Record<string, { home?: unknown, away?: unknown }>} */ (
    incoming[scoresKey] ?? {}
  )[id];
  return (
    is === "started" &&
    incomingConfirmed[id] === false &&
    Object.prototype.hasOwnProperty.call(incomingConfirmed, id) &&
    !scoreIsEmpty(sc) &&
    !isKickoffPlaceholder(sc)
  );
}

/**
 * Reinicio o desconfirmación explícita del admin en `incoming` frente a `baseline`.
 * @param {Record<string, unknown>} incoming
 * @param {Record<string, unknown>} baseline
 * @param {string} id
 * @param {"group"|"ko"} kind
 */
export function isExplicitMatchDowngrade(incoming, baseline, id, kind) {
  const stateKey = kind === "group" ? "groupMatchState" : "knockoutMatchState";
  const confirmedKey = kind === "group" ? "groupScoresConfirmed" : "knockoutScoresConfirmed";
  const scoresKey = kind === "group" ? "groupScores" : "knockoutScores";

  const is = /** @type {Record<string, string>} */ (incoming[stateKey] ?? {})[id] ?? "ready";
  const bs = /** @type {Record<string, string>} */ (baseline[stateKey] ?? {})[id] ?? "ready";
  const ic =
    /** @type {Record<string, boolean>} */ (incoming[confirmedKey] ?? {})[id] === true;
  const sc = /** @type {Record<string, { home?: unknown, away?: unknown }>} */ (
    incoming[scoresKey] ?? {}
  )[id];
  const incomingStates = /** @type {Record<string, string>} */ (incoming[stateKey] ?? {});
  const incomingConfirmed = /** @type {Record<string, boolean>} */ (incoming[confirmedKey] ?? {});
  const explicitRestart =
    incomingConfirmed[id] === false &&
    Object.prototype.hasOwnProperty.call(incomingConfirmed, id);

  if (
    is === "ready" &&
    stageRank(bs) >= 1 &&
    !ic &&
    scoreIsEmpty(sc) &&
    (Object.prototype.hasOwnProperty.call(incomingStates, id) || explicitRestart)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>} side
 * @param {string} id
 * @param {"group"|"ko"} kind
 */
function sliceFrom(side, id, kind) {
  if (kind === "group") {
    return {
      state: /** @type {Record<string, string>} */ (side.groupMatchState ?? {})[id] ?? "ready",
      score: /** @type {Record<string, object>} */ (side.groupScores ?? {})[id],
      confirmed:
        /** @type {Record<string, boolean>} */ (side.groupScoresConfirmed ?? {})[id] === true,
    };
  }
  return {
    state: /** @type {Record<string, string>} */ (side.knockoutMatchState ?? {})[id] ?? "ready",
    score: /** @type {Record<string, object>} */ (side.knockoutScores ?? {})[id],
    confirmed:
      /** @type {Record<string, boolean>} */ (side.knockoutScoresConfirmed ?? {})[id] === true,
  };
}

/** @param {Record<string, unknown>} local @param {Record<string, unknown>} remote @param {string} id */
function pickGroupMatchSlice(local, remote, id) {
  const localFinish = isExplicitMatchFinish(local, id, "group");
  const remoteFinish = isExplicitMatchFinish(remote, id, "group");
  const localUnconfirm = isExplicitMatchUnconfirm(local, remote, id, "group");
  const remoteUnconfirm = isExplicitMatchUnconfirm(remote, local, id, "group");

  if (localUnconfirm && remoteFinish) return sliceFrom(local, id, "group");
  if (remoteUnconfirm && localFinish) return sliceFrom(remote, id, "group");

  if (isExplicitMatchDowngrade(remote, local, id, "group")) {
    return sliceFrom(remote, id, "group");
  }
  if (isExplicitMatchDowngrade(local, remote, id, "group")) {
    return sliceFrom(local, id, "group");
  }

  if (localFinish && !remoteFinish) return sliceFrom(local, id, "group");
  if (remoteFinish && !localFinish) return sliceFrom(remote, id, "group");

  const ls = /** @type {Record<string, string>} */ (local.groupMatchState ?? {})[id] ?? "ready";
  const rs = /** @type {Record<string, string>} */ (remote.groupMatchState ?? {})[id] ?? "ready";

  if (ls === "finished" || rs === "finished") {
    const lc =
      /** @type {Record<string, boolean>} */ (local.groupScoresConfirmed ?? {})[id] === true;
    const rc =
      /** @type {Record<string, boolean>} */ (remote.groupScoresConfirmed ?? {})[id] === true;
    if (ls === "finished" && rs === "finished") {
      const score =
        rc && /** @type {Record<string, object>} */ (remote.groupScores ?? {})[id]
          ? /** @type {Record<string, object>} */ (remote.groupScores)[id]
          : lc && /** @type {Record<string, object>} */ (local.groupScores ?? {})[id]
            ? /** @type {Record<string, object>} */ (local.groupScores)[id]
            : /** @type {Record<string, object>} */ (remote.groupScores ?? {})[id] ??
              /** @type {Record<string, object>} */ (local.groupScores ?? {})[id];
      return { state: "finished", score, confirmed: lc || rc };
    }
    return sliceFrom(ls === "finished" ? local : remote, id, "group");
  }

  const lr = stageRank(ls);
  const rr = stageRank(rs);
  if (rr > lr) {
    return {
      state: rs,
      score:
        /** @type {Record<string, object>} */ (remote.groupScores ?? {})[id] ??
        /** @type {Record<string, object>} */ (local.groupScores ?? {})[id],
      confirmed:
        /** @type {Record<string, boolean>} */ (remote.groupScoresConfirmed ?? {})[id] === true,
    };
  }
  if (lr > rr) {
    return {
      state: ls,
      score:
        /** @type {Record<string, object>} */ (local.groupScores ?? {})[id] ??
        /** @type {Record<string, object>} */ (remote.groupScores ?? {})[id],
      confirmed:
        /** @type {Record<string, boolean>} */ (local.groupScoresConfirmed ?? {})[id] === true,
    };
  }
  const lc =
    /** @type {Record<string, boolean>} */ (local.groupScoresConfirmed ?? {})[id] === true;
  const rc =
    /** @type {Record<string, boolean>} */ (remote.groupScoresConfirmed ?? {})[id] === true;
  const score =
    rc && /** @type {Record<string, object>} */ (remote.groupScores ?? {})[id]
      ? /** @type {Record<string, object>} */ (remote.groupScores)[id]
      : lc && /** @type {Record<string, object>} */ (local.groupScores ?? {})[id]
        ? /** @type {Record<string, object>} */ (local.groupScores)[id]
        : /** @type {Record<string, object>} */ (local.groupScores ?? {})[id] ??
          /** @type {Record<string, object>} */ (remote.groupScores ?? {})[id];
  return { state: ls, score, confirmed: lc || rc };
}

/** @param {Record<string, unknown>} local @param {Record<string, unknown>} remote @param {string} id */
function pickKnockoutMatchSlice(local, remote, id) {
  const localFinish = isExplicitMatchFinish(local, id, "ko");
  const remoteFinish = isExplicitMatchFinish(remote, id, "ko");
  const localUnconfirm = isExplicitMatchUnconfirm(local, remote, id, "ko");
  const remoteUnconfirm = isExplicitMatchUnconfirm(remote, local, id, "ko");

  if (localUnconfirm && remoteFinish) return sliceFrom(local, id, "ko");
  if (remoteUnconfirm && localFinish) return sliceFrom(remote, id, "ko");

  if (isExplicitMatchDowngrade(remote, local, id, "ko")) {
    return sliceFrom(remote, id, "ko");
  }
  if (isExplicitMatchDowngrade(local, remote, id, "ko")) {
    return sliceFrom(local, id, "ko");
  }

  if (localFinish && !remoteFinish) return sliceFrom(local, id, "ko");
  if (remoteFinish && !localFinish) return sliceFrom(remote, id, "ko");

  const ls = /** @type {Record<string, string>} */ (local.knockoutMatchState ?? {})[id] ?? "ready";
  const rs = /** @type {Record<string, string>} */ (remote.knockoutMatchState ?? {})[id] ?? "ready";

  if (ls === "finished" || rs === "finished") {
    const lc =
      /** @type {Record<string, boolean>} */ (local.knockoutScoresConfirmed ?? {})[id] === true;
    const rc =
      /** @type {Record<string, boolean>} */ (remote.knockoutScoresConfirmed ?? {})[id] === true;
    if (ls === "finished" && rs === "finished") {
      const score =
        rc && /** @type {Record<string, object>} */ (remote.knockoutScores ?? {})[id]
          ? /** @type {Record<string, object>} */ (remote.knockoutScores)[id]
          : lc && /** @type {Record<string, object>} */ (local.knockoutScores ?? {})[id]
            ? /** @type {Record<string, object>} */ (local.knockoutScores)[id]
            : /** @type {Record<string, object>} */ (remote.knockoutScores ?? {})[id] ??
              /** @type {Record<string, object>} */ (local.knockoutScores ?? {})[id];
      return { state: "finished", score, confirmed: lc || rc };
    }
    return sliceFrom(ls === "finished" ? local : remote, id, "ko");
  }

  const lr = stageRank(ls);
  const rr = stageRank(rs);
  if (rr > lr) {
    return {
      state: rs,
      score:
        /** @type {Record<string, object>} */ (remote.knockoutScores ?? {})[id] ??
        /** @type {Record<string, object>} */ (local.knockoutScores ?? {})[id],
      confirmed:
        /** @type {Record<string, boolean>} */ (remote.knockoutScoresConfirmed ?? {})[id] === true,
    };
  }
  if (lr > rr) {
    return {
      state: ls,
      score:
        /** @type {Record<string, object>} */ (local.knockoutScores ?? {})[id] ??
        /** @type {Record<string, object>} */ (remote.knockoutScores ?? {})[id],
      confirmed:
        /** @type {Record<string, boolean>} */ (local.knockoutScoresConfirmed ?? {})[id] === true,
    };
  }
  const lc =
    /** @type {Record<string, boolean>} */ (local.knockoutScoresConfirmed ?? {})[id] === true;
  const rc =
    /** @type {Record<string, boolean>} */ (remote.knockoutScoresConfirmed ?? {})[id] === true;
  const score =
    rc && /** @type {Record<string, object>} */ (remote.knockoutScores ?? {})[id]
      ? /** @type {Record<string, object>} */ (remote.knockoutScores)[id]
      : lc && /** @type {Record<string, object>} */ (local.knockoutScores ?? {})[id]
        ? /** @type {Record<string, object>} */ (local.knockoutScores)[id]
        : /** @type {Record<string, object>} */ (local.knockoutScores ?? {})[id] ??
          /** @type {Record<string, object>} */ (remote.knockoutScores ?? {})[id];
  return { state: ls, score, confirmed: lc || rc };
}

/**
 * Une dos snapshots ya normalizados sin perder partidos terminados.
 * @param {Record<string, unknown>} local
 * @param {Record<string, unknown>} remote
 */
export function mergeOfficialPreferAdvancedNormalized(local, remote) {
  const out = { ...local };

  const groupIds = new Set([
    ...Object.keys(/** @type {Record<string, unknown>} */ (local.groupMatchState ?? {})),
    ...Object.keys(/** @type {Record<string, unknown>} */ (remote.groupMatchState ?? {})),
    ...Object.keys(/** @type {Record<string, unknown>} */ (local.groupScores ?? {})),
    ...Object.keys(/** @type {Record<string, unknown>} */ (remote.groupScores ?? {})),
  ]);
  for (const id of groupIds) {
    const pick = pickGroupMatchSlice(local, remote, id);
    if (pick.state === "ready" && scoreIsEmpty(/** @type {{ home?: unknown, away?: unknown } | undefined} */ (pick.score))) {
      out.groupMatchState = { .../** @type {object} */ (out.groupMatchState), [id]: "ready" };
      delete /** @type {Record<string, unknown>} */ (out.groupScores)[id];
      const nextGroupConfirmed = { .../** @type {object} */ (out.groupScoresConfirmed) };
      delete nextGroupConfirmed[id];
      out.groupScoresConfirmed = nextGroupConfirmed;
      continue;
    }
    if (pick.state !== "ready") {
      out.groupMatchState = { .../** @type {object} */ (out.groupMatchState), [id]: pick.state };
    }
    if (pick.score) {
      out.groupScores = { .../** @type {object} */ (out.groupScores), [id]: pick.score };
    }
    if (pick.confirmed) {
      out.groupScoresConfirmed = {
        .../** @type {object} */ (out.groupScoresConfirmed),
        [id]: true,
      };
    } else {
      const next = { .../** @type {object} */ (out.groupScoresConfirmed) };
      delete next[id];
      out.groupScoresConfirmed = next;
    }
  }

  const koIds = new Set([
    ...Object.keys(/** @type {Record<string, unknown>} */ (local.knockoutMatchState ?? {})),
    ...Object.keys(/** @type {Record<string, unknown>} */ (remote.knockoutMatchState ?? {})),
    ...Object.keys(/** @type {Record<string, unknown>} */ (local.knockoutScores ?? {})),
    ...Object.keys(/** @type {Record<string, unknown>} */ (remote.knockoutScores ?? {})),
  ]);
  for (const id of koIds) {
    const pick = pickKnockoutMatchSlice(local, remote, id);
    if (pick.state === "ready" && scoreIsEmpty(/** @type {{ home?: unknown, away?: unknown } | undefined} */ (pick.score))) {
      out.knockoutMatchState = {
        .../** @type {object} */ (out.knockoutMatchState),
        [id]: "ready",
      };
      delete /** @type {Record<string, unknown>} */ (out.knockoutScores)[id];
      const nextKoConfirmed = { .../** @type {object} */ (out.knockoutScoresConfirmed) };
      delete nextKoConfirmed[id];
      out.knockoutScoresConfirmed = nextKoConfirmed;
      continue;
    }
    if (pick.state !== "ready") {
      out.knockoutMatchState = {
        .../** @type {object} */ (out.knockoutMatchState),
        [id]: pick.state,
      };
    }
    if (pick.score) {
      out.knockoutScores = { .../** @type {object} */ (out.knockoutScores), [id]: pick.score };
    }
    if (pick.confirmed) {
      out.knockoutScoresConfirmed = {
        .../** @type {object} */ (out.knockoutScoresConfirmed),
        [id]: true,
      };
    } else {
      const next = { .../** @type {object} */ (out.knockoutScoresConfirmed) };
      delete next[id];
      out.knockoutScoresConfirmed = next;
    }
  }

  if (remote.generalOfficialConfirmed && !local.generalOfficialConfirmed) {
    out.generalOfficial = { .../** @type {object} */ (local.generalOfficial), ...remote.generalOfficial };
    out.generalOfficialConfirmed = true;
  }
  if (remote.groupPredictionsBlockedForAll || local.groupPredictionsBlockedForAll) {
    out.groupPredictionsBlockedForAll =
      remote.groupPredictionsBlockedForAll || local.groupPredictionsBlockedForAll;
  }
  if (
    remote.generalPredictionsBlockedForParticipants ||
    local.generalPredictionsBlockedForParticipants
  ) {
    out.generalPredictionsBlockedForParticipants =
      remote.generalPredictionsBlockedForParticipants ||
      local.generalPredictionsBlockedForParticipants;
  }

  return out;
}
