/**
 * API + WebSocket + persistencia en disco para uso local o despliegue.
 * Datos en server/data/state.json (sobrevive a reiniciar el proceso).
 */

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import {
  BUILTIN_PARTICIPANTS,
  reconcileParticipantsWithBuiltin,
  ADMIN_PARTICIPANT_ID,
} from "../src/participants.js";
import { emptyOfficialResults } from "../src/official-results-store.js";
import { emptyPredictions } from "../src/predictions-store.js";
import { notifyArenaPrivadasSync } from "./privadas-arena-notify.mjs";
import { startOfficialKickoffPoll } from "./official-kickoff.mjs";
import { isSyncSecretValid } from "./sync-secret.mjs";
import {
  normalizeOfficialPayload,
  officialPayloadEqual,
} from "./official-sync-shared.mjs";
import { normalizePredictionsData } from "../src/predictions-store.js";
import { mergeOfficialPreferAdvancedNormalized } from "../src/official-sync-merge.js";
import { mergePredictionsPreferAdvanced } from "../src/predictions-merge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PM26_DATA_DIR || path.join(__dirname, "data");
const STATE_PATH = path.join(DATA_DIR, "state.json");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = Number(process.env.PM26_MAX_BACKUPS || 50);
/** Mínimo entre copias automáticas (ms). state.json sigue guardándose en cada cambio. */
const BACKUP_MIN_INTERVAL_MS = Number(process.env.PM26_BACKUP_INTERVAL_MS || 5 * 60 * 1000);
const DIST_DIR = path.join(__dirname, "..", "dist");

const PORT = Number(process.env.PORT || 8787);

function defaultState() {
  return {
    participants: structuredClone(BUILTIN_PARTICIPANTS),
    official: emptyOfficialResults(),
    predictions: {},
    officialUpdatedAt: null,
  };
}

/** @type {{ participants: unknown[]; official: object; predictions: Record<string, object>; officialUpdatedAt?: string | null }} */
let state = defaultState();

/** @type {Set<import("ws").WebSocket>} */
const wsClients = new Set();

function pruneServerPredictionsToParticipants() {
  const ids = new Set(
    state.participants.map((p) => String((p && p.id) ?? "").trim()).filter(Boolean),
  );
  for (const key of Object.keys(state.predictions)) {
    if (!ids.has(key)) delete state.predictions[key];
  }
}

function getCompetingParticipantIds() {
  return state.participants
    .map((p) => String((p && p.id) ?? "").trim())
    .filter((id) => id && id !== ADMIN_PARTICIPANT_ID);
}

function applyParticipantsState(list) {
  state.participants = reconcileParticipantsWithBuiltin(
    Array.isArray(list) ? list : defaultState().participants,
  );
  pruneServerPredictionsToParticipants();
}

function getPublicState() {
  return {
    participants: state.participants,
    official: normalizeOfficialPayload(state.official),
    predictions: state.predictions,
    officialUpdatedAt: state.officialUpdatedAt ?? null,
  };
}

async function ensureDataDir() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
}

async function loadStateFromDisk() {
  try {
    const raw = await fs.promises.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    state = {
      participants: Array.isArray(parsed.participants) ? parsed.participants : defaultState().participants,
      official:
        typeof parsed.official === "object" && parsed.official
          ? normalizeOfficialPayload(parsed.official)
          : emptyOfficialResults(),
      predictions: typeof parsed.predictions === "object" && parsed.predictions ? parsed.predictions : {},
      officialUpdatedAt:
        typeof parsed.officialUpdatedAt === "string" ? parsed.officialUpdatedAt : null,
    };
    applyParticipantsState(state.participants);
    if (!state.officialUpdatedAt) {
      try {
        const st = await fs.promises.stat(STATE_PATH);
        state.officialUpdatedAt = st.mtime.toISOString();
      } catch {
        state.officialUpdatedAt = new Date().toISOString();
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Evita copias idénticas consecutivas en disco. */
let lastBackupContentHash = "";
let lastBackupAt = 0;

function hashContent(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

async function pruneOldBackups() {
  let files;
  try {
    files = await fs.promises.readdir(BACKUPS_DIR);
  } catch {
    return;
  }
  const jsonFiles = files.filter((f) => /^state-.+\.json$/.test(f)).sort();
  while (jsonFiles.length > MAX_BACKUPS) {
    const oldest = jsonFiles.shift();
    if (!oldest) break;
    await fs.promises.unlink(path.join(BACKUPS_DIR, oldest)).catch(() => {});
  }
}

async function maybeCreateBackupSnapshot(json) {
  const hash = hashContent(json);
  if (hash === lastBackupContentHash) return;

  const now = Date.now();
  if (now - lastBackupAt < BACKUP_MIN_INTERVAL_MS) return;

  lastBackupContentHash = hash;
  lastBackupAt = now;

  await fs.promises.mkdir(BACKUPS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `state-${ts}.json`;
  await fs.promises.writeFile(path.join(BACKUPS_DIR, name), json, "utf8");
  await pruneOldBackups();
}

async function saveStateToDisk() {
  await ensureDataDir();
  const tmp = STATE_PATH + ".tmp";
  const json = JSON.stringify(getPublicState(), null, 0);
  await fs.promises.writeFile(tmp, json, "utf8");
  try {
    await fs.promises.rename(tmp, STATE_PATH);
  } catch {
    await fs.promises.copyFile(tmp, STATE_PATH);
    await fs.promises.unlink(tmp).catch(() => {});
  }
  await maybeCreateBackupSnapshot(json);
}

function isValidStateBody(body) {
  return (
    body &&
    typeof body === "object" &&
    Array.isArray(body.participants) &&
    typeof body.official === "object" &&
    body.official &&
    typeof body.predictions === "object" &&
    body.predictions
  );
}

function applyFullStateBody(body) {
  state = {
    participants: body.participants,
    official: body.official,
    predictions: body.predictions,
    officialUpdatedAt:
      typeof body.officialUpdatedAt === "string"
        ? body.officialUpdatedAt
        : new Date().toISOString(),
  };
  applyParticipantsState(state.participants);
}

async function commitOfficialFromClient(official) {
  const now = new Date().toISOString();
  const incoming = normalizeOfficialPayload(official);
  const server = normalizeOfficialPayload(state.official);
  const merged = normalizeOfficialPayload(
    mergeOfficialPreferAdvancedNormalized(incoming, server),
  );
  if (officialPayloadEqual(server, merged)) return;
  state.official = merged;
  state.officialUpdatedAt = now;
  await persistAndBroadcast();
}

function broadcastState() {
  const payload = JSON.stringify({ type: "state", data: getPublicState() });
  for (const c of wsClients) {
    if (c.readyState === 1) c.send(payload);
  }
}

async function persistAndBroadcast() {
  await saveStateToDisk();
  broadcastState();
  void notifyArenaPrivadasSync();
}

const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/state", (_req, res) => {
  res.json(getPublicState());
});

app.put("/api/state", (req, res) => {
  if (!isValidStateBody(req.body)) {
    res.status(400).json({ error: "estado inválido (participants, official, predictions)" });
    return;
  }
  applyFullStateBody(req.body);
  persistAndBroadcast()
    .then(() => res.json({ ok: true, data: getPublicState() }))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "persistencia fallida" });
    });
});

app.get("/api/backups", async (_req, res) => {
  try {
    await fs.promises.mkdir(BACKUPS_DIR, { recursive: true });
    const files = await fs.promises.readdir(BACKUPS_DIR);
    const items = [];
    for (const name of files.filter((f) => /^state-.+\.json$/.test(f)).sort().reverse()) {
      const stat = await fs.promises.stat(path.join(BACKUPS_DIR, name));
      items.push({
        filename: name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      });
    }
    res.json({ ok: true, maxBackups: MAX_BACKUPS, backups: items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "no se pudo listar backups" });
  }
});

app.get("/api/backups/:filename", async (req, res) => {
  const name = path.basename(String(req.params.filename ?? ""));
  if (!/^state-.+\.json$/.test(name)) {
    res.status(400).json({ error: "nombre inválido" });
    return;
  }
  const filePath = path.join(BACKUPS_DIR, name);
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    res.type("application/json").send(raw);
  } catch {
    res.status(404).json({ error: "backup no encontrado" });
  }
});

app.post("/api/restore/:filename", async (req, res) => {
  const name = path.basename(String(req.params.filename ?? ""));
  if (!/^state-.+\.json$/.test(name)) {
    res.status(400).json({ error: "nombre inválido" });
    return;
  }
  const filePath = path.join(BACKUPS_DIR, name);
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!isValidStateBody(parsed)) {
      res.status(400).json({ error: "backup corrupto o formato inválido" });
      return;
    }
    applyFullStateBody(parsed);
    await persistAndBroadcast();
    res.json({ ok: true, data: getPublicState(), restoredFrom: name });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
      res.status(404).json({ error: "backup no encontrado" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "restauración fallida" });
  }
});

app.put("/api/official", (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "body inválido" });
    return;
  }
  commitOfficialFromClient(req.body)
    .then(() => res.json({ ok: true }))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "persistencia fallida" });
    });
});

app.post("/api/internal/sync-official", (req, res) => {
  if (!isSyncSecretValid(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  /** Los resultados oficiales ya no se comparten con Arena. */
  res.json({ ok: true, changed: false, ignored: true });
});

app.put("/api/predictions/:participantId", (req, res) => {
  const id = String(req.params.participantId ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "id requerido" });
    return;
  }
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "body inválido" });
    return;
  }
  const existing = state.predictions[id];
  const incoming = normalizePredictionsData(req.body);
  state.predictions[id] =
    existing != null
      ? mergePredictionsPreferAdvanced(existing, incoming)
      : incoming;  persistAndBroadcast()
    .then(() => res.json({ ok: true }))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "persistencia fallida" });
    });
});

app.delete("/api/predictions/:participantId", (req, res) => {
  const id = String(req.params.participantId ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "id requerido" });
    return;
  }
  delete state.predictions[id];
  persistAndBroadcast()
    .then(() => res.json({ ok: true }))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "persistencia fallida" });
    });
});

app.put("/api/participants", (req, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400).json({ error: "se esperaba un array" });
    return;
  }
  applyParticipantsState(req.body);
  persistAndBroadcast()
    .then(() => res.json({ ok: true }))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "persistencia fallida" });
    });
});

app.post("/api/reset-quiniela", (_req, res) => {
  state.predictions = {};
  state.official = emptyOfficialResults();
  state.officialUpdatedAt = new Date().toISOString();
  persistAndBroadcast()
    .then(() => res.json({ ok: true, data: getPublicState() }))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "persistencia fallida" });
    });
});

/** Sirve landing (/) y quiniela (/PrediccionesMundial/) si existe dist/. */
const QUINIELA_DIST = path.join(DIST_DIR, "PrediccionesMundial");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!req.path.startsWith("/PrediccionesMundial")) return next();
    if (!fs.existsSync(QUINIELA_DIST)) return next();
    res.sendFile(path.join(QUINIELA_DIST, "index.html"));
  });
}

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  wsClients.add(socket);
  try {
    socket.send(JSON.stringify({ type: "state", data: getPublicState() }));
  } catch {
    /* ignore */
  }
  socket.on("close", () => wsClients.delete(socket));
});

async function main() {
  await ensureDataDir();
  const loaded = await loadStateFromDisk();
  if (!loaded) {
    state = defaultState();
    await saveStateToDisk();
    console.log("[pm26] Archivo nuevo:", STATE_PATH);
  } else {
    console.log("[pm26] Estado cargado desde", STATE_PATH);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[pm26] API en http://localhost:${PORT} (0.0.0.0 — accesible en LAN si abres el firewall)`);
    if (!fs.existsSync(DIST_DIR)) {
      console.log("[pm26] Desarrollo: en paralelo `npm run dev` (Vite 5173) con proxy /api y /ws hacia este puerto.");
    }
  });

  server.on("error", (err) => {
    if (err && typeof err === "object" && "code" in err && err.code === "EADDRINUSE") {
      console.error(`[pm26] Puerto ${PORT} ya en uso (hay otra instancia corriendo).`);
      console.error(`[pm26] Windows: netstat -ano | findstr :${PORT}  →  taskkill /PID <n> /F`);
      console.error(`[pm26] O usa otro puerto: set PORT=8789 && npm run server`);
      process.exit(1);
    }
    throw err;
  });

  startOfficialKickoffPoll(
    () => state.official,
    (next) => {
      state.official = normalizeOfficialPayload(next);
      state.officialUpdatedAt = new Date().toISOString();
      void persistAndBroadcast();
    },
    () => state.predictions,
    (next) => {
      state.predictions = next;
      void persistAndBroadcast();
    },
    getCompetingParticipantIds,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
