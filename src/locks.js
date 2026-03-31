/**
 * @param {string | null | undefined} isoKickoff
 * @returns {boolean} true si ya no se puede editar
 */
export function isLockedAtKickoff(isoKickoff) {
  if (!isoKickoff) return false;
  const t = Date.parse(isoKickoff);
  if (Number.isNaN(t)) return false;
  return Date.now() >= t;
}
