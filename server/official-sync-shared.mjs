import { normalizeOfficialResultsData } from "../src/official-results-store.js";
import { mergeOfficialPreferAdvancedNormalized } from "../src/official-sync-merge.js";

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

/**
 * Une dos snapshots oficiales sin perder partidos terminados en ningún lado.
 * @param {unknown} localRaw
 * @param {unknown} remoteRaw
 */
export function mergeOfficialPreferAdvanced(localRaw, remoteRaw) {
  const local = normalizeOfficialPayload(localRaw);
  const remote = normalizeOfficialPayload(remoteRaw);
  return normalizeOfficialPayload(mergeOfficialPreferAdvancedNormalized(local, remote));
}

/** @param {unknown} local @param {string|null|undefined} localAt @param {unknown} remote @param {string|null|undefined} remoteAt */
export function reconcileOfficialForSync(local, localAt, remote, remoteAt) {
  const cmp = compareOfficialUpdatedAt(remoteAt, localAt);
  /** Siempre fusionar por partido: finished no retrocede; kickoff solo avanza ready→started. */
  const merged = mergeOfficialPreferAdvanced(local, remote);
  if (officialPayloadEqual(local, merged)) {
    return { changed: false, merged, updatedAt: localAt ?? remoteAt ?? null };
  }
  const newerAt =
    cmp >= 0
      ? (remoteAt ?? localAt ?? new Date().toISOString())
      : (localAt ?? remoteAt ?? new Date().toISOString());
  return {
    changed: true,
    merged,
    updatedAt: newerAt ?? new Date().toISOString(),
  };
}
