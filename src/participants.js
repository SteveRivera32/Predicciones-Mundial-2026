/**
 * Lista canónica de participantes: quien esté aquí compite en rankings y tablas.
 * Al sincronizar con el servidor se quitan ids que ya no figuren en este array.
 * El admin puede añadir jugadores desde Ajustes (también deben existir aquí para persistir).
 * Si `pin` es un string, debe introducirse una vez por navegador para confirmar identidad.
 * Si es `null`, no se pide PIN.
 */

import { isRemoteSyncActive } from "./remote-sync-flags.js";
import {
  isArenaMode,
  isArenaAdmin,
  getArenaUserId,
  getArenaUser,
  getArenaRankingAudience,
} from "./arena-mode.js";
import { searchTextIncludes } from "./search-normalize.js";
import { prunePredictionsToParticipantIds } from "./predictions-store.js";
import { pushParticipants } from "./sync-push.js";
import { clearPinVerifiedForParticipant } from "./session.js";

export const BUILTIN_PARTICIPANTS = [
  { id: "tivo", name: "Tivo", pin: "xd127821" },
  { id: "admin", name: "ADMIN", pin: "50396508" },
  { id: "rick", name: "Rick", pin: "crot3923" },
  { id: "ozeb", name: "Ozeb", pin: "pilin891" },
  { id: "elcalvo", name: "ElCalvo", pin: "sexoh741" },
  { id: "akinian", name: "Akinian", pin: "pene9935" },
  { id: "ale", name: "Ale", pin: "jimmd237" },
  { id: "jonny", name: "Jonny", pin: "culo2104" },
];

/**
 * @typedef {{ id: string, name: string, pin: string | null, hue?: number, color?: string }} Participant
 */

/** Matiz por defecto (0–359) derivado del id. */
export function defaultHueForParticipantId(id) {
  const s = String(id);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

function hslToHex(h, s, l) {
  const hh = ((Number(h) % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, Number(s))) / 100;
  const ll = Math.max(0, Math.min(100, Number(l))) / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n) => {
    const k = (n + hh / 30) % 12;
    const c = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c);
  };
  return `#${[f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return { r: 110, g: 200, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d > 1e-6) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r1) h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6;
    else if (max === g1) h = ((b1 - r1) / d + 2) / 6;
    else h = ((r1 - g1) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Color de acento (#rrggbb): personalizado o derivado de hue automático previo / hash del id.
 * @param {Participant | null | undefined} p
 */
export function getParticipantAccentHex(p) {
  const raw = p && p.color != null ? String(p.color).trim() : "";
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (p && typeof p.hue === "number" && Number.isFinite(p.hue)) {
    const hh = ((Math.round(p.hue) % 360) + 360) % 360;
    return hslToHex(hh, 88, 72);
  }
  return hslToHex(defaultHueForParticipantId(p?.id ?? ""), 88, 72);
}

/**
 * Matiz (0–359) coherente con el color mostrado (p. ej. podio).
 * @param {Participant | null | undefined} p
 */
export function getParticipantDisplayHue(p) {
  return hexToHsl(getParticipantAccentHex(p)).h;
}

/**
 * @param {unknown} raw
 * @returns {number | undefined}
 */
function normalizeHueField(raw) {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return ((Math.round(n) % 360) + 360) % 360;
}

/**
 * @param {unknown} raw
 * @returns {string | undefined}
 */
function normalizeColorField(raw) {
  if (raw == null || raw === "") return undefined;
  const s = String(raw).trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : undefined;
}

/** Hay color o matiz guardado distinto del puro automático por defecto. */
export function hasParticipantCustomAccent(p) {
  return normalizeColorField(p?.color) != null || normalizeHueField(p?.hue) != null;
}

let remoteParticipantsMode = false;
/** @type {Participant[]} */
let remoteParticipantsList = [];
/** @type {Participant[]} */
let localParticipantsList = [];

/** Id principal del participante administrador mostrado en UI. */
export const ADMIN_PARTICIPANT_ID = "admin";

/** Participantes de la quiniela privada que compiten (sin la cuenta técnica admin). */
export function getPrivadasArenaMirrorParticipants() {
  return BUILTIN_PARTICIPANTS.filter(
    (p) => p.id !== ADMIN_PARTICIPANT_ID && p.pin != null && String(p.pin).length > 0,
  ).map((p) => ({ id: p.id, name: p.name, pin: String(p.pin) }));
}

/** Usuario reservado para la quiniela privada (no registrable en Arena). */
export function isPrivadasArenaMirrorId(id) {
  const key = String(id ?? "").trim().toLowerCase();
  return getPrivadasArenaMirrorParticipants().some((p) => p.id.toLowerCase() === key);
}

/** Ranking Arena filtrado a jugadores registrados (sin espejos de Predicciones Amigos). */
export function isArenaFollowersRankingActive() {
  return isArenaMode() && getArenaRankingAudience() === "followers";
}

/** @param {Participant[]} participants */
export function filterParticipantsForArenaRankingAudience(participants) {
  if (!isArenaFollowersRankingActive()) return participants;
  return participants.filter((p) => !isPrivadasArenaMirrorId(p.id));
}
/** Administradores con permisos sobre resultados oficiales/Ajustes. */
const OFFICIAL_RESULTS_ADMIN_IDS = new Set(["tivo", "admin"]);

/** Super-admin de pruebas: además puede editar predicciones de todos y forzar cruces sin definir. */
const SUPER_ADMIN_PARTICIPANT_IDS = new Set(["admin"]);
/** Iniciar, terminar, reiniciar y desconfirmar partidos en Predicciones de partidos. */
const PARTIDOS_MATCH_FLOW_ADMIN_IDS = new Set(["admin"]);

/** @param {unknown} p */
function normalizeParticipant(p) {
  const id = String((p && p.id) ?? "").trim();
  const name = String((p && p.name) ?? "").trim() || id;
  const pinRaw = p && p.pin;
  const pin = pinRaw == null || pinRaw === "" ? null : String(pinRaw);
  const color = normalizeColorField(p && p.color);
  const hue = normalizeHueField(p && p.hue);
  /** @type {Participant} */
  const out = { id, name, pin };
  if (color) {
    out.color = color;
  } else if (hue !== undefined) {
    out.hue = hue;
  }
  return out;
}

function seedFromBuiltin() {
  return BUILTIN_PARTICIPANTS.map((p) => ({ ...p }));
}

const builtinById = new Map(BUILTIN_PARTICIPANTS.map((p) => [p.id, p]));
const builtinParticipantIds = new Set(BUILTIN_PARTICIPANTS.map((p) => p.id));

/**
 * Participantes incluidos en BUILTIN_PARTICIPANTS: si en código el PIN no es null/vacío,
 * ese valor manda (localStorage o servidor pueden traer un PIN viejo, p. ej. a12, y el código a14).
 * Si en el código el PIN es null, se conserva el guardado (PIN establecido solo en datos/admin).
 * @param {Participant[]} list
 * @returns {Participant[]}
 */
function applyBuiltinPinDefaults(list) {
  return list.map((p) => {
    const b = builtinById.get(p.id);
    if (!b) return p;
    if (b.pin != null && b.pin !== "") {
      return { ...p, pin: b.pin };
    }
    return p;
  });
}

/** PIN efectivo (builtin en código manda sobre copias viejas del servidor). */
function effectivePinForParticipant(p) {
  if (!p?.id) return null;
  const b = builtinById.get(p.id);
  if (b?.pin != null && b.pin !== "") return b.pin;
  return p.pin ?? null;
}

function effectivePinsSignature(list) {
  const normalized = applyBuiltinPinDefaults(
    reconcileParticipantsWithBuiltin(Array.isArray(list) ? list : []),
  );
  return JSON.stringify(
    normalized
      .map((p) => [p.id, effectivePinForParticipant(p)])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}

/**
 * Lista de jugadores alineada con `BUILTIN_PARTICIPANTS`:
 * quita ids que ya no están en código y añade los nuevos al final.
 * @param {Participant[]} list
 * @returns {Participant[]}
 */
export function reconcileParticipantsWithBuiltin(list) {
  if (isArenaMode()) {
    const seen = new Set();
    return (Array.isArray(list) ? list : [])
      .filter((p) => {
        if (!p?.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .map((p) => normalizeParticipant(p))
      .filter((p) => p.id);
  }
  const out = (Array.isArray(list) ? list : [])
    .filter((p) => p && builtinParticipantIds.has(p.id))
    .map((p) => ({ ...p }));
  const ids = new Set(out.map((p) => p.id));
  for (const b of BUILTIN_PARTICIPANTS) {
    if (ids.has(b.id)) continue;
    out.push({ ...b });
  }
  return out;
}

function participantIdsSignature(list) {
  return JSON.stringify(list.map((p) => p.id).sort());
}

/**
 * Actualiza lista con PIN del builtin, limpia verificación de PIN si el valor efectivo cambió,
 * y opcionalmente persiste + empuja al servidor.
 * @param {Participant[]} current
 * @param {{ remoteWrite: boolean }} opts
 * @returns {Participant[]}
 */
function mergeAndPersistBuiltinPins(current, opts) {
  const withBuiltin = reconcileParticipantsWithBuiltin(current);
  const merged = isArenaMode() ? withBuiltin : applyBuiltinPinDefaults(withBuiltin);
  const rosterChanged = participantIdsSignature(current) !== participantIdsSignature(merged);
  const pinsChanged = effectivePinsSignature(current) !== effectivePinsSignature(merged);
  if (!rosterChanged && !pinsChanged) return merged;

  if (rosterChanged) {
    prunePredictionsToParticipantIds(merged.map((p) => p.id));
  }

  const prevEffectivePins = new Map(
    applyBuiltinPinDefaults(reconcileParticipantsWithBuiltin(current)).map((p) => [
      p.id,
      effectivePinForParticipant(p),
    ]),
  );
  for (const m of merged) {
    const before = prevEffectivePins.get(m.id);
    const after = effectivePinForParticipant(m);
    if (before !== undefined && before !== after) clearPinVerifiedForParticipant(m.id);
  }

  if (opts.remoteWrite) {
    remoteParticipantsList = merged;
  } else {
    localParticipantsList = merged;
  }
  if (opts.remoteWrite && isRemoteSyncActive() && (rosterChanged || pinsChanged)) {
    pushParticipants(merged).catch((e) => console.error("[pm26 sync]", e));
  }
  return merged;
}

/** @returns {Participant | null} */
function arenaSessionParticipant() {
  const au = getArenaUser();
  if (!au?.id) return null;
  return { id: au.id, name: au.displayName || au.id, pin: null };
}

/**
 * En Arena el usuario logueado debe existir aunque el sync aún no haya traído la lista completa.
 * @param {Participant[]} list
 * @returns {Participant[]}
 */
function withArenaCurrentUser(list) {
  if (!isArenaMode()) return list;
  const au = arenaSessionParticipant();
  if (!au) return list;
  if (list.some((p) => p.id === au.id)) return list;
  return [...list, au];
}

/**
 * @returns {Participant[]}
 */
export function getParticipants() {
  let list;
  if (remoteParticipantsMode) {
    const merged = mergeAndPersistBuiltinPins(remoteParticipantsList, { remoteWrite: true });
    list = merged.map((p) => ({ ...p }));
  } else {
    if (localParticipantsList.length === 0) {
      localParticipantsList = seedFromBuiltin();
    }
    const merged = mergeAndPersistBuiltinPins(localParticipantsList, { remoteWrite: false });
    list = merged.map((p) => ({ ...p }));
  }
  return withArenaCurrentUser(list);
}

/**
 * Participantes visibles como jugadores (rankings, tablas «predicciones de todos», quiniela, selects).
 * La cuenta técnica `admin` no compite ni se lista; el resto (incl. Tivo) sí.
 * En Arena los administradores no compiten ni aparecen en tablas (solo su sesión).
 * @returns {Participant[]}
 */
export function getParticipantsForDisplay() {
  const list = getParticipants();
  if (isArenaMode()) {
    const me = getArenaUserId();
    return list.filter((p) => !(isArenaAdmin() && p.id === me));
  }
  return list.filter((p) => p.id !== ADMIN_PARTICIPANT_ID);
}

/** @param {unknown[]} list */
export function hydrateParticipantsFromRemote(list) {
  remoteParticipantsMode = true;
  const prevPinsSig = effectivePinsSignature(remoteParticipantsList);
  const prevEffectivePins = new Map(
    applyBuiltinPinDefaults(reconcileParticipantsWithBuiltin(remoteParticipantsList)).map((p) => [
      p.id,
      effectivePinForParticipant(p),
    ]),
  );
  if (!Array.isArray(list) || list.length === 0) {
    if (isArenaMode()) {
      remoteParticipantsList = [];
    } else {
      remoteParticipantsList = seedFromBuiltin();
    }
  } else {
    const parsed = list.map(normalizeParticipant).filter((p) => p.id);
    const seen = new Set();
    remoteParticipantsList = parsed.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    if (remoteParticipantsList.length === 0) {
      remoteParticipantsList = seedFromBuiltin();
    }
  }
  const idsBeforeReconcile = participantIdsSignature(remoteParticipantsList);
  remoteParticipantsList = reconcileParticipantsWithBuiltin(remoteParticipantsList);
  if (!isArenaMode()) {
    remoteParticipantsList = applyBuiltinPinDefaults(remoteParticipantsList);
  }
  if (effectivePinsSignature(remoteParticipantsList) !== prevPinsSig) {
    for (const p of applyBuiltinPinDefaults(reconcileParticipantsWithBuiltin(remoteParticipantsList))) {
      const before = prevEffectivePins.get(p.id);
      const after = effectivePinForParticipant(p);
      if (before !== undefined && before !== after) clearPinVerifiedForParticipant(p.id);
    }
  }
  if (
    idsBeforeReconcile !== participantIdsSignature(remoteParticipantsList) &&
    isRemoteSyncActive()
  ) {
    prunePredictionsToParticipantIds(remoteParticipantsList.map((p) => p.id));
    pushParticipants(remoteParticipantsList).catch((e) => console.error("[pm26 sync]", e));
  }
}

export function disableRemoteParticipants() {
  remoteParticipantsMode = false;
  if (remoteParticipantsList.length > 0) {
    localParticipantsList = remoteParticipantsList.map((p) => ({ ...p }));
  }
  remoteParticipantsList = [];
}

/**
 * @param {Participant[]} list
 */
export function setParticipantsList(list) {
  const parsed = Array.isArray(list) ? list.map(normalizeParticipant).filter((p) => p.id) : [];
  const seen = new Set();
  let next = parsed.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  next = reconcileParticipantsWithBuiltin(next);
  if (next.length === 0) {
    next = seedFromBuiltin();
  }
  prunePredictionsToParticipantIds(next.map((p) => p.id));
  if (remoteParticipantsMode) {
    remoteParticipantsList = next;
    if (isRemoteSyncActive()) {
      pushParticipants(remoteParticipantsList).catch((e) => console.error("[pm26 sync]", e));
    }
    return;
  }
  localParticipantsList = next;
}

export function getParticipantById(id) {
  const sid = String(id ?? "").trim();
  if (!sid) return null;
  const found = getParticipants().find((p) => p.id === sid) ?? null;
  if (found) return found;
  if (isArenaMode()) {
    const au = arenaSessionParticipant();
    if (au && au.id === sid) return au;
  }
  return null;
}

/**
 * Color de acento en hex (#rrggbb). `null` quita personalización (vuelve al automático por id).
 * @param {string} participantId
 * @param {string | null | undefined} hexOrNull
 */
export function setParticipantColor(participantId, hexOrNull) {
  const id = String(participantId ?? "").trim();
  if (!id) return;
  const list = getParticipants().map((p) => {
    if (p.id !== id) return { ...p };
    if (hexOrNull == null || hexOrNull === "") {
      const next = { ...p };
      delete next.color;
      delete next.hue;
      return next;
    }
    const hex = normalizeColorField(hexOrNull);
    if (!hex) return { ...p };
    const next = { ...p, color: hex };
    delete next.hue;
    return next;
  });
  setParticipantsList(list);
}

/**
 * Matiz 0–359 (compatibilidad). Si se define, elimina `color` guardado.
 * @param {string} participantId
 * @param {number | null | undefined} hueOrNull
 */
export function setParticipantHue(participantId, hueOrNull) {
  const id = String(participantId ?? "").trim();
  if (!id) return;
  const list = getParticipants().map((p) => {
    if (p.id !== id) return { ...p };
    if (hueOrNull == null || hueOrNull === "") {
      const next = { ...p };
      delete next.hue;
      delete next.color;
      return next;
    }
    const h = normalizeHueField(hueOrNull);
    if (h === undefined) {
      const next = { ...p };
      delete next.hue;
      delete next.color;
      return next;
    }
    const next = { ...p, hue: h };
    delete next.color;
    return next;
  });
  setParticipantsList(list);
}

/** Quién puede cargar el marcador oficial y abrir Ajustes. */
export function canEditOfficialResults(participantId) {
  if (isArenaMode()) return isArenaAdmin() && participantId === getArenaUserId();
  return OFFICIAL_RESULTS_ADMIN_IDS.has(participantId);
}

/** Quién ve los controles de ciclo de vida del partido (iniciar, terminar, reiniciar, etc.). */
export function canManagePartidosMatchFlow(participantId) {
  if (isArenaMode()) {
    return isArenaAdmin() && participantId === getArenaUserId();
  }
  return PARTIDOS_MATCH_FLOW_ADMIN_IDS.has(participantId);
}

export function isAdminParticipantId(id) {
  return OFFICIAL_RESULTS_ADMIN_IDS.has(id);
}

export function canEditAllParticipantsPredictions(participantId) {
  if (isArenaMode()) return false;
  return SUPER_ADMIN_PARTICIPANT_IDS.has(participantId);
}

/** Super-admin: asignar o corregir predicciones no confirmadas tras el cierre del partido. */
export function canAdminEditLateMatchPredictions(participantId) {
  return canEditAllParticipantsPredictions(participantId);
}

const PARTICIPANT_SEARCH_KEY = "pm26-participant-search";
const PARTICIPANT_SORT_KEY = "pm26-participant-sort";

/** @typedef {"default" | "points-desc" | "points-asc"} ParticipantSortMode */

/** Máx. otros jugadores en tablas de predicciones (sin contar «tú»). */
export const ARENA_PARTICIPANT_PREVIEW_LIMIT = 49;

export function getParticipantSearchQuery() {
  if (!isArenaMode()) return "";
  try {
    return localStorage.getItem(PARTICIPANT_SEARCH_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setParticipantSearchQuery(query) {
  try {
    localStorage.setItem(PARTICIPANT_SEARCH_KEY, String(query ?? ""));
  } catch {
    /* ignore */
  }
}

/** @returns {ParticipantSortMode} */
export function getParticipantSortMode() {
  if (!isArenaMode()) return "default";
  try {
    const v = localStorage.getItem(PARTICIPANT_SORT_KEY);
    if (v === "points-desc" || v === "points-asc") return v;
  } catch {
    /* ignore */
  }
  return "default";
}

/** @returns {ParticipantSortMode} */
export function cycleParticipantSortMode() {
  /** @type {ParticipantSortMode[]} */
  const order = ["default", "points-desc", "points-asc"];
  const cur = getParticipantSortMode();
  const next = order[(order.indexOf(cur) + 1) % order.length];
  try {
    localStorage.setItem(PARTICIPANT_SORT_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

/** @param {ParticipantSortMode} [mode] */
export function participantSortModeLabel(mode = getParticipantSortMode()) {
  if (mode === "points-desc") return "Ordenar por: Más puntos";
  if (mode === "points-asc") return "Ordenar por: Menos puntos";
  return "Ordenar por: Predeterminado";
}

/**
 * @param {{ id?: string, name?: string } | null | undefined} p
 * @param {string} query
 */
export function participantMatchesSearchQuery(p, query) {
  const q = String(query ?? "").trim();
  if (!q) return true;
  return searchTextIncludes(p?.name, q) || searchTextIncludes(p?.id, q);
}

/** @param {string} seed */
function hashStablePreviewSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Orden pseudoaleatorio estable (misma muestra hasta que cambie la lista o el apartado).
 * @param {Participant[]} list
 * @param {string} [seedPrefix]
 */
function stableRandomParticipantOrder(list, seedPrefix = "pm26-arena-preview") {
  return [...list].sort((a, b) => {
    const ha = hashStablePreviewSeed(`${seedPrefix}:${a.id}`);
    const hb = hashStablePreviewSeed(`${seedPrefix}:${b.id}`);
    if (ha !== hb) return ha - hb;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
}

/**
 * Listas de predicciones Arena: tú primero; cupo de otros = top 49 por puntos del apartado (si ya puntúa) o muestra aleatoria estable;
 * solo quienes mandaron predicción en el apartado; orden de filas según botón (predeterminado = alfabético).
 * @param {string | null | undefined} currentId
 * @param {string} [searchQuery]
 * @param {{ hasSubmission?: (p: Participant) => boolean, getPoints?: (p: Participant) => number, scoringActive?: boolean, previewSeed?: string }} [opts]
 * @returns {Participant[]}
 */
export function getParticipantsForListDisplay(
  currentId,
  searchQuery = getParticipantSearchQuery(),
  opts = {},
) {
  const base = getParticipantsForDisplay();
  let self = currentId ? base.find((p) => p.id === currentId) : null;
  if (!self && isArenaMode() && currentId) {
    const au = arenaSessionParticipant();
    if (au && au.id === currentId) self = au;
  }
  const q = String(searchQuery ?? "").trim();
  let others = base.filter((p) => p.id !== currentId);
  const byName = (/** @type {Participant} */ a, /** @type {Participant} */ b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  const hasSubmission = opts.hasSubmission;
  const getPoints = opts.getPoints;
  const scoringActive = opts.scoringActive === true;
  const previewSeed = String(opts.previewSeed ?? "pm26-arena-preview");
  const sortMode = isArenaMode() ? getParticipantSortMode() : "default";

  if (isArenaMode() && hasSubmission) {
    if (self && !hasSubmission(self)) self = null;
    others = others.filter((p) => hasSubmission(p));
  }
  if (q) {
    others = others.filter((p) => participantMatchesSearchQuery(p, q));
    if (self && !participantMatchesSearchQuery(self, q)) self = null;
  }

  if (isArenaMode() && !q) {
    if (scoringActive && typeof getPoints === "function") {
      others = [...others].sort((a, b) => {
        const diff = getPoints(b) - getPoints(a);
        if (diff !== 0) return diff;
        return byName(a, b);
      });
    } else {
      others = stableRandomParticipantOrder(others, previewSeed);
    }
    others = others.slice(0, ARENA_PARTICIPANT_PREVIEW_LIMIT);
  }

  if (sortMode === "points-desc" && typeof getPoints === "function") {
    others.sort((a, b) => {
      const diff = getPoints(b) - getPoints(a);
      if (diff !== 0) return diff;
      return byName(a, b);
    });
  } else if (sortMode === "points-asc" && typeof getPoints === "function") {
    others.sort((a, b) => {
      const diff = getPoints(a) - getPoints(b);
      if (diff !== 0) return diff;
      return byName(a, b);
    });
  } else {
    others.sort(byName);
  }

  if (self) return [self, ...others];
  return others;
}

/**
 * @param {string} [searchQuery]
 * @param {{ hasSubmission?: (p: Participant) => boolean, currentId?: string | null }} [opts]
 * @returns {{ total: number, shown: number, truncated: boolean, withoutSubmission: number }}
 */
export function getArenaParticipantsListMeta(searchQuery = getParticipantSearchQuery(), opts = {}) {
  const { hasSubmission, currentId } = opts;
  const base = getParticipantsForDisplay();
  if (!isArenaMode()) {
    const total = base.length;
    return { total, shown: total, truncated: false, withoutSubmission: 0 };
  }
  const q = String(searchQuery ?? "").trim();
  const withoutSubmission = hasSubmission ? base.filter((p) => !hasSubmission(p)).length : 0;
  const submissionPool = hasSubmission ? base.filter((p) => hasSubmission(p)) : base;
  const total = submissionPool.length;
  if (q) {
    const filtered = submissionPool.filter((p) => participantMatchesSearchQuery(p, q));
    return { total, shown: filtered.length, truncated: false, withoutSubmission };
  }
  const list = getParticipantsForListDisplay(currentId ?? null, searchQuery, opts);
  const shown = hasSubmission ? list.filter((p) => hasSubmission(p)).length : list.length;
  const truncated = total > ARENA_PARTICIPANT_PREVIEW_LIMIT;
  return { total, shown, truncated, withoutSubmission };
}

/**
 * Rankings: conserva puesto real en `displayRank`; en Arena tú arriba; en privadas orden normal.
 * La búsqueda filtra al resto pero siempre muestra tu fila.
 * @template T
 * @param {T[]} rows filas ya ordenadas por puntos
 * @param {string | null | undefined} currentId
 * @param {string} [searchQuery]
 * @returns {(T & { displayRank: number })[]}
 */
export function orderRankingRowsForDisplay(rows, currentId, searchQuery = getParticipantSearchQuery()) {
  /** @param {unknown} r */
  const getP = (r) => {
    const row = /** @type {{ p?: Participant, participant?: Participant }} */ (r);
    return row.p ?? row.participant ?? null;
  };
  /** @param {unknown} r */
  const isSelf = (r) => {
    const row = /** @type {{ self?: boolean }} */ (r);
    if (row.self === true) return true;
    const p = getP(r);
    return Boolean(currentId && p && p.id === currentId);
  };

  const withRank = rows.map((r, i) => ({
    ...r,
    displayRank: r.displayRank ?? r.rank ?? i + 1,
  }));
  const q = String(searchQuery ?? "").trim();
  let list = withRank;
  if (q) {
    list = withRank.filter((r) => isSelf(r) || participantMatchesSearchQuery(getP(r), q));
  }
  if (!isArenaMode()) return list;
  const selfRow = list.find(isSelf);
  if (!selfRow || !currentId) return list;
  return [selfRow, ...list.filter((r) => !isSelf(r))];
}
