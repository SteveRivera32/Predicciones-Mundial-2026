/**
 * Normaliza texto para búsqueda: minúsculas sin acentos ni diacríticos.
 * @param {unknown} value
 */
export function normalizeForSearch(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * @param {unknown} haystack
 * @param {unknown} needle
 */
export function searchTextIncludes(haystack, needle) {
  const q = normalizeForSearch(needle);
  if (!q) return true;
  return normalizeForSearch(haystack).includes(q);
}
