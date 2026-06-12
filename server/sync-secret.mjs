/** Cabecera compartida para endpoints internos privadas ↔ Arena. */

export function syncSecretHeaders() {
  const secret = process.env.ARENA_PRIVADAS_SYNC_SECRET ?? "";
  if (!secret) return {};
  return { "X-Arena-Sync-Secret": secret };
}

/** @param {import("express").Request} req */
export function isSyncSecretValid(req) {
  const secret = process.env.ARENA_PRIVADAS_SYNC_SECRET ?? "";
  if (!secret) return true;
  return req.headers["x-arena-sync-secret"] === secret;
}
