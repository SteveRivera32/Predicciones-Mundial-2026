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

import { BUILTIN_PARTICIPANTS } from "../src/participants.js";
import { emptyOfficialResults } from "../src/official-results-store.js";
import { emptyPredictions } from "../src/predictions-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PM26_DATA_DIR || path.join(__dirname, "data");
const STATE_PATH = path.join(DATA_DIR, "state.json");
const DIST_DIR = path.join(__dirname, "..", "dist");

const PORT = Number(process.env.PORT || 8787);

function defaultState() {
  return {
    participants: structuredClone(BUILTIN_PARTICIPANTS),
    official: emptyOfficialResults(),
    predictions: {},
  };
}

/** @type {{ participants: unknown[]; official: object; predictions: Record<string, object> }} */
let state = defaultState();

/** @type {Set<import("ws").WebSocket>} */
const wsClients = new Set();

function getPublicState() {
  return {
    participants: state.participants,
    official: state.official,
    predictions: state.predictions,
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
      official: typeof parsed.official === "object" && parsed.official ? parsed.official : emptyOfficialResults(),
      predictions: typeof parsed.predictions === "object" && parsed.predictions ? parsed.predictions : {},
    };
    return true;
  } catch {
    return false;
  }
}

async function saveStateToDisk() {
  await ensureDataDir();
  const tmp = STATE_PATH + ".tmp";
  const json = JSON.stringify(getPublicState(), null, 0);
  await fs.promises.writeFile(tmp, json, "utf8");
  await fs.promises.rename(tmp, STATE_PATH);
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
}

const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/state", (_req, res) => {
  res.json(getPublicState());
});

app.put("/api/official", (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "body inválido" });
    return;
  }
  state.official = req.body;
  persistAndBroadcast()
    .then(() => res.json({ ok: true }))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "persistencia fallida" });
    });
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
  state.predictions[id] = req.body;
  persistAndBroadcast()
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
  state.participants = req.body;
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
  persistAndBroadcast()
    .then(() => res.json({ ok: true, data: getPublicState() }))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "persistencia fallida" });
    });
});

/** Sirve la app construida si existe dist/ (despliegue en un solo puerto). */
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
