/**
 * Espeja participantes y predicciones de la quiniela privada en Arena.
 * Los jugadores privados siguen editando en privadas; Arena solo refleja sus picks.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPrivadasArenaMirrorParticipants } from "../../src/participants.js";
import { normalizePredictionsData } from "../../src/predictions-store.js";
import { hashPassword } from "./auth.mjs";
import {
  upsertPrivadasUser,
  getUserPredictions,
  setUserPredictions,
  findUserByUsername,
} from "./db.mjs";
import { PASSWORD_LEN } from "./password-rules.mjs";
import { applyOfficialFromPrivadasIfNewer } from "./official-privadas-sync.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_PATH = path.join(__dirname, "..", "..", "server", "data", "state.json");

/** @type {Map<string, string>} id → último PIN aplicado */
const lastPinByUser = new Map();

/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

/** @param {() => void} [onPredictionsChanged] */
async function fetchPrivadasState() {
  const url = process.env.ARENA_PRIVADAS_SYNC_URL || "http://127.0.0.1:8787/api/state";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) return res.json();
  } catch {
    /* servidor apagado: fallback a disco */
  }
  const filePath = process.env.ARENA_PRIVADAS_STATE_PATH || DEFAULT_STATE_PATH;
  if (filePath && fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  throw new Error("quiniela privada inaccesible");
}

/**
 * @param {() => void} [onPredictionsChanged]
 * @returns {Promise<boolean>}
 */
export async function syncPrivadasToArena(onPredictionsChanged) {
  /** @type {Record<string, unknown>} */
  let state;
  try {
    state = await fetchPrivadasState();
  } catch (e) {
    console.warn("[arena] sync privadas:", e instanceof Error ? e.message : e);
    return false;
  }

  const participantsById = new Map(
    (Array.isArray(state.participants) ? state.participants : []).map((p) => [
      String(p?.id ?? ""),
      p,
    ]),
  );
  const predictions = state.predictions && typeof state.predictions === "object" ? state.predictions : {};

  let predictionsChanged = false;

  for (const p of getPrivadasArenaMirrorParticipants()) {
    if (p.pin.length !== PASSWORD_LEN) {
      console.warn(
        `[arena] sync privadas: «${p.id}» tiene PIN de ${p.pin.length} caracteres; Arena exige ${PASSWORD_LEN}.`,
      );
      continue;
    }

    const displayName =
      String(participantsById.get(p.id)?.name ?? "").trim() || p.name;
    let user = findUserByUsername(p.id);
    if (!user || lastPinByUser.get(p.id) !== p.pin) {
      const passwordHash = await hashPassword(p.pin);
      user = upsertPrivadasUser({ username: p.id, passwordHash, displayName });
      lastPinByUser.set(p.id, p.pin);
    } else if (user.display_name !== displayName) {
      user = upsertPrivadasUser({
        username: p.id,
        passwordHash: user.password_hash,
        displayName,
      });
    }

    const raw = predictions[p.id];
    if (!raw) continue;
    const normalized = normalizePredictionsData(raw);
    const current = getUserPredictions(user.id);
    if (JSON.stringify(current.data) !== JSON.stringify(normalized)) {
      setUserPredictions(user.id, normalized);
      predictionsChanged = true;
    }
  }

  if (predictionsChanged) onPredictionsChanged?.();

  if (state.official) {
    applyOfficialFromPrivadasIfNewer(
      state.official,
      state.officialUpdatedAt ?? null,
      onPredictionsChanged,
    );
  }

  return true;
}

/** @param {() => void} [onPredictionsChanged] */
export function startPrivadasSyncPoll(onPredictionsChanged) {
  const intervalMs = Math.max(5000, Number(process.env.ARENA_PRIVADAS_SYNC_MS || 15_000));
  void syncPrivadasToArena(onPredictionsChanged);
  if (pollTimer != null) return;
  pollTimer = setInterval(() => {
    void syncPrivadasToArena(onPredictionsChanged);
  }, intervalMs);
}
