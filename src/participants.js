/**
 * Lista canónica de participantes: quien esté aquí compite en rankings y tablas.
 * Al sincronizar con el servidor se quitan ids que ya no figuren en este array.
 * El admin puede añadir jugadores desde Ajustes (también deben existir aquí para persistir).
 * Si `pin` es un string, debe introducirse una vez por navegador para confirmar identidad.
 * Si es `null`, no se pide PIN.
 */

import { isRemoteSyncActive } from "./remote-sync-flags.js";
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
/** Administradores con permisos sobre resultados oficiales/Ajustes. */
const OFFICIAL_RESULTS_ADMIN_IDS = new Set(["tivo", "admin"]);
/** Super-admin de pruebas: además puede editar predicciones de todos y forzar cruces sin definir. */
const SUPER_ADMIN_PARTICIPANT_IDS = new Set(["admin"]);

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

function pinPairsJson(participants) {
  return JSON.stringify(participants.map((p) => [p.id, p.pin ?? null]));
}

/**
 * Lista de jugadores alineada con `BUILTIN_PARTICIPANTS`:
 * quita ids que ya no están en código y añade los nuevos al final.
 * @param {Participant[]} list
 * @returns {Participant[]}
 */
export function reconcileParticipantsWithBuiltin(list) {
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
  const merged = applyBuiltinPinDefaults(withBuiltin);
  const rosterChanged = participantIdsSignature(current) !== participantIdsSignature(merged);
  const pinsChanged = pinPairsJson(current) !== pinPairsJson(merged);
  if (!rosterChanged && !pinsChanged) return merged;

  if (rosterChanged) {
    prunePredictionsToParticipantIds(merged.map((p) => p.id));
  }

  for (const p of current) {
    const m = merged.find((x) => x.id === p.id);
    if (!m) continue;
    const before = p.pin ?? null;
    const after = m.pin ?? null;
    if (before !== after) clearPinVerifiedForParticipant(p.id);
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

/**
 * @returns {Participant[]}
 */
export function getParticipants() {
  if (remoteParticipantsMode) {
    const merged = mergeAndPersistBuiltinPins(remoteParticipantsList, { remoteWrite: true });
    return merged.map((p) => ({ ...p }));
  }
  if (localParticipantsList.length === 0) {
    localParticipantsList = seedFromBuiltin();
  }
  const merged = mergeAndPersistBuiltinPins(localParticipantsList, { remoteWrite: false });
  return merged.map((p) => ({ ...p }));
}

/**
 * Participantes visibles como jugadores (rankings, tablas «predicciones de todos», quiniela, selects).
 * La cuenta técnica `admin` no compite ni se lista; el resto (incl. Tivo) sí.
 * @returns {Participant[]}
 */
export function getParticipantsForDisplay() {
  return getParticipants().filter((p) => p.id !== ADMIN_PARTICIPANT_ID);
}

/** @param {unknown[]} list */
export function hydrateParticipantsFromRemote(list) {
  remoteParticipantsMode = true;
  if (!Array.isArray(list) || list.length === 0) {
    remoteParticipantsList = seedFromBuiltin();
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
  const beforePins = remoteParticipantsList.map((p) => ({ id: p.id, pin: p.pin ?? null }));
  remoteParticipantsList = applyBuiltinPinDefaults(remoteParticipantsList);
  for (const b of beforePins) {
    const now = remoteParticipantsList.find((x) => x.id === b.id);
    const before = b.pin ?? null;
    const after = now?.pin ?? null;
    if (before !== after) clearPinVerifiedForParticipant(b.id);
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
  return getParticipants().find((p) => p.id === id) ?? null;
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
  return OFFICIAL_RESULTS_ADMIN_IDS.has(participantId);
}

export function isAdminParticipantId(id) {
  return OFFICIAL_RESULTS_ADMIN_IDS.has(id);
}

export function canEditAllParticipantsPredictions(participantId) {
  return SUPER_ADMIN_PARTICIPANT_IDS.has(participantId);
}
