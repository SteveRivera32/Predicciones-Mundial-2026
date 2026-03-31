/**
 * Lista inicial de participantes (se copia a localStorage la primera vez).
 * El admin puede añadir o quitar participantes desde Ajustes; esta lista es solo semilla.
 * Si `pin` es un string, debe introducirse una vez por navegador para confirmar identidad.
 * Si es `null`, no se pide PIN.
 */

import { isRemoteSyncActive } from "./remote-sync-flags.js";
import { pushParticipants } from "./sync-push.js";
import { clearPinVerifiedForParticipant } from "./session.js";

export const BUILTIN_PARTICIPANTS = [
  { id: "tivo", name: "Tivo", pin: "xd12" },
  { id: "rick", name: "Rick", pin: "null" },
  { id: "ozeb", name: "Ozeb", pin: null },
  { id: "elcalvo", name: "ElCalvo", pin: null },
  { id: "akinian", name: "Akinian", pin: null },
  { id: "ale", name: "Ale", pin: null },
  { id: "jonny", name: "Jonny", pin: null },
  { id: "eljumo", name: "ElJumo", pin: "a15" },
];

const STORAGE_KEY = "pm26-participants-list";

/**
 * @typedef {{ id: string, name: string, pin: string | null }} Participant
 */

let remoteParticipantsMode = false;
/** @type {Participant[]} */
let remoteParticipantsList = [];

/** Id del participante que actúa como administrador; no se puede eliminar desde Ajustes. */
export const ADMIN_PARTICIPANT_ID = "tivo";

/** @param {unknown} p */
function normalizeParticipant(p) {
  const id = String((p && p.id) ?? "").trim();
  const name = String((p && p.name) ?? "").trim() || id;
  const pinRaw = p && p.pin;
  const pin = pinRaw == null || pinRaw === "" ? null : String(pinRaw);
  return { id, name, pin };
}

function seedFromBuiltin() {
  return BUILTIN_PARTICIPANTS.map((p) => ({ ...p }));
}

const builtinById = new Map(BUILTIN_PARTICIPANTS.map((p) => [p.id, p]));

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
 * Actualiza lista con PIN del builtin, limpia verificación de PIN si el valor efectivo cambió,
 * y opcionalmente persiste + empuja al servidor.
 * @param {Participant[]} current
 * @param {{ remoteWrite: boolean }} opts
 * @returns {Participant[]}
 */
function mergeAndPersistBuiltinPins(current, opts) {
  const merged = applyBuiltinPinDefaults(current);
  if (pinPairsJson(current) === pinPairsJson(merged)) return merged;

  for (const p of current) {
    const m = merged.find((x) => x.id === p.id);
    if (!m) continue;
    const before = p.pin ?? null;
    const after = m.pin ?? null;
    if (before !== after) clearPinVerifiedForParticipant(p.id);
  }

  if (opts.remoteWrite) {
    remoteParticipantsList = merged;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  if (opts.remoteWrite && isRemoteSyncActive()) {
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
  if (typeof localStorage === "undefined") {
    return seedFromBuiltin();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = seedFromBuiltin();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) {
      const seed = seedFromBuiltin();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const list = data.map(normalizeParticipant).filter((p) => p.id);
    const seen = new Set();
    const uniq = list.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    if (uniq.length === 0) {
      const seed = seedFromBuiltin();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const merged = mergeAndPersistBuiltinPins(uniq, { remoteWrite: false });
    return merged.map((p) => ({ ...p }));
  } catch {
    const seed = seedFromBuiltin();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    } catch {
      /* ignore */
    }
    return seed;
  }
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
  const beforePins = remoteParticipantsList.map((p) => ({ id: p.id, pin: p.pin ?? null }));
  remoteParticipantsList = applyBuiltinPinDefaults(remoteParticipantsList);
  for (const b of beforePins) {
    const now = remoteParticipantsList.find((x) => x.id === b.id);
    const before = b.pin ?? null;
    const after = now?.pin ?? null;
    if (before !== after) clearPinVerifiedForParticipant(b.id);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteParticipantsList));
  } catch {
    /* ignore */
  }
}

export function disableRemoteParticipants() {
  remoteParticipantsMode = false;
  remoteParticipantsList = [];
}

/**
 * @param {Participant[]} list
 */
export function setParticipantsList(list) {
  if (remoteParticipantsMode) {
    const parsed = Array.isArray(list) ? list.map(normalizeParticipant).filter((p) => p.id) : [];
    const seen = new Set();
    remoteParticipantsList = parsed.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    if (remoteParticipantsList.length === 0) {
      remoteParticipantsList = seedFromBuiltin();
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteParticipantsList));
    } catch {
      /* ignore */
    }
    if (isRemoteSyncActive()) {
      pushParticipants(remoteParticipantsList).catch((e) => console.error("[pm26 sync]", e));
    }
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getParticipantById(id) {
  return getParticipants().find((p) => p.id === id) ?? null;
}

/** Quién puede cargar el marcador oficial y abrir Ajustes. */
export function canEditOfficialResults(participantId) {
  return participantId === ADMIN_PARTICIPANT_ID;
}

export function isAdminParticipantId(id) {
  return id === ADMIN_PARTICIPANT_ID;
}
