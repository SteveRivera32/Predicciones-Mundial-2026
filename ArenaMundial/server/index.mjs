/**
 * API pública Arena Mundial — sin WebSocket ni broadcast global.
 * Puerto 8788 (independiente de la quiniela privada en 8787).
 */

import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import {
  initDb,
  findUserByUsername,
  findUserById,
  createUser,
  countArenaUsers,
  getUserPredictions,
  setUserPredictions,
  getOfficialResults,
  isPublicNameTaken,
  getAllArenaParticipants,
  getPreviewPredictionsByUsername,
  searchPredictionsByQuery,
  insertChatMessage,
  getChatMessagesSince,
  getLatestChatMessageId,
  isPrivadasUser,
  deleteUserById,
  searchUsersByQuery,
  getDeviceBindingByDeviceId,
  getCountableDeviceBindingByDeviceId,
  bindDeviceToUser,
  registerArenaUserWithDevice,
  isDeviceBanned,
  banArenaUserById,
  listArenaUsersForAdmin,
  countCompetingUsers,
  setArenaDataChangedHandler,
} from "./db.mjs";
import {
  scheduleArenaBackup,
  listArenaBackupFiles,
  readArenaBackupFile,
  restoreArenaFromBackupPayload,
  createArenaBackupEnvelopeNow,
  getArenaMaxBackups,
} from "./arena-backups.mjs";
import { resolveDeviceId } from "./device-cookie.mjs";
import {
  sanitizeChatBody,
  checkChatRateLimit,
  recordChatSend,
  CHAT_MAX_LEN,
} from "./chat.mjs";
import {
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  publicUser,
  requireAuth,
  requireAdmin,
} from "./auth.mjs";
import { normalizePredictionsData } from "../../src/predictions-store.js";
import { normalizeOfficialResultsData } from "../../src/official-results-store.js";
import { authTrafficGuard } from "./rate-limit.mjs";
import { isValidArenaPassword, passwordRuleMessage } from "./password-rules.mjs";
import { startOfficialKickoffPoll } from "./official-kickoff.mjs";
import { syncPrivadasToArena, startPrivadasSyncPoll } from "./privadas-bridge.mjs";
import { isPrivadasArenaMirrorId } from "../../src/participants.js";
import { applyOfficialFromPrivadasIfNewer, saveArenaOfficial } from "./official-privadas-sync.mjs";
import { isSyncSecretValid } from "../../server/sync-secret.mjs";
import { getCachedArenaRankings, invalidateArenaRankingsCache } from "./arena-rankings.mjs";
import { getCachedArenaMatchVoteData, invalidateArenaMatchVoteCache } from "./arena-match-votes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ARENA_PORT || 8788);
const DIST_DIR = path.join(__dirname, "..", "..", "dist-arena");
const SERVE_STATIC = process.argv.includes("--serve-static");
const MAX_USERS = Number(process.env.ARENA_MAX_USERS || 10000);

const app = express();
app.use(express.json({ limit: "512kb" }));
app.use(cookieParser());

/** Cache en memoria para datos compartidos (oficial, rankings). */
const sharedCache = {
  official: { data: null, etag: "", at: 0 },
  rankings: { data: null, etag: "", at: 0 },
};
const SHARED_CACHE_MS = Number(process.env.ARENA_SHARED_CACHE_MS || 3_000);
const PREVIEW_PREDICTIONS_LIMIT = Number(process.env.ARENA_PREVIEW_PREDICTIONS || 49);

function bumpEtag() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function invalidateSharedCache() {
  sharedCache.official = { data: null, etag: "", at: 0 };
  sharedCache.rankings = { data: null, etag: "", at: 0 };
  invalidateArenaRankingsCache();
  invalidateArenaMatchVoteCache();
}

function usernameValid(s) {
  return /^[a-z0-9_]{3,20}$/.test(s);
}

function rejectBannedDevice(res, deviceId) {
  if (!isDeviceBanned(deviceId)) return false;
  res.status(403).json({
    error: "este dispositivo no puede usar Arena; contacta al administrador si crees que es un error",
  });
  return true;
}

// ── Auth ────────────────────────────────────────────────────────────────────

app.get("/api/arena/auth/device-binding", authTrafficGuard, (req, res) => {
  const deviceId = resolveDeviceId(req, res);
  if (rejectBannedDevice(res, deviceId)) return;
  const binding = getCountableDeviceBindingByDeviceId(deviceId);
  if (!binding) {
    res.json({ bound: false });
    return;
  }
  res.json({
    bound: true,
    username: binding.username,
    displayName: binding.display_name,
    isPrivadas: false,
  });
});

app.post("/api/arena/auth/delete-device-account", authTrafficGuard, (req, res) => {
  const deviceId = resolveDeviceId(req, res);
  const username = String(req.body?.username ?? "")
    .trim()
    .toLowerCase();
  if (!usernameValid(username)) {
    res.status(400).json({ error: "usuario inválido" });
    return;
  }
  const binding = getDeviceBindingByDeviceId(deviceId);
  if (!binding) {
    res.status(404).json({ error: "no hay cuenta registrada en este dispositivo" });
    return;
  }
  const user = findUserByUsername(username);
  if (!user || user.id !== binding.user_id) {
    res.status(403).json({ error: "el usuario no coincide con la cuenta de este dispositivo" });
    return;
  }
  if (isPrivadasUser(user.id)) {
    res.status(403).json({
      error: "cuenta espejo de la quiniela privada; no se puede eliminar desde Arena",
    });
    return;
  }
  const result = deleteUserById(user.id);
  if (!result.ok) {
    if (result.error === "last_admin") {
      res.status(403).json({
        error: "eres el último administrador; pide a otro admin que te sustituya antes de borrarte",
      });
      return;
    }
    res.status(404).json({ error: "usuario no encontrado" });
    return;
  }
  clearAuthCookie(res);
  invalidateSharedCache();
  res.json({ ok: true, username: result.username });
});

app.post("/api/arena/auth/register", authTrafficGuard, async (req, res) => {
  try {
    if (countArenaUsers() >= MAX_USERS) {
      res.status(503).json({ error: "cupo máximo alcanzado" });
      return;
    }
    const username = String(req.body?.username ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? "");
    const displayNameRaw = String(req.body?.displayName ?? "").trim();
    const deviceId = resolveDeviceId(req, res);
    if (rejectBannedDevice(res, deviceId)) return;

    if (!usernameValid(username)) {
      res.status(400).json({ error: "usuario: 3–20 caracteres, letras, números o _" });
      return;
    }
    if (isPrivadasArenaMirrorId(username)) {
      res.status(409).json({
        error: "ese usuario pertenece a la quiniela privada; entra con tu PIN de privadas",
      });
      return;
    }
    if (!isValidArenaPassword(password)) {
      res.status(400).json({ error: passwordRuleMessage() });
      return;
    }
    if (displayNameRaw.length > 20) {
      res.status(400).json({ error: "nombre visible: máx. 20 caracteres" });
      return;
    }
    if (isPublicNameTaken(username)) {
      res.status(409).json({ error: "ese usuario ya está en uso" });
      return;
    }
    const displayName = displayNameRaw || username;
    if (displayName.toLowerCase() !== username.toLowerCase() && isPublicNameTaken(displayName)) {
      res.status(409).json({ error: "ese nombre visible ya está en uso" });
      return;
    }

    const isFirstUser = countArenaUsers() === 0;
    const passwordHash = await hashPassword(password);
    const registered = registerArenaUserWithDevice({
      username,
      passwordHash,
      displayName,
      isAdmin: isFirstUser,
      deviceId,
    });
    if (!registered.ok) {
      res.status(409).json({
        error: `este dispositivo ya tiene la cuenta «${registered.username}»; entra con tu contraseña o bórrala desde el login`,
      });
      return;
    }
    const user = registered.user;
    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ ok: true, user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "registro fallido" });
  }
});

app.post("/api/arena/auth/login", authTrafficGuard, async (req, res) => {
  const username = String(req.body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!isValidArenaPassword(password)) {
    res.status(400).json({ error: passwordRuleMessage() });
    return;
  }
  const user = findUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    res.status(401).json({ error: "usuario o contraseña incorrectos" });
    return;
  }
  const deviceId = resolveDeviceId(req, res);
  if (rejectBannedDevice(res, deviceId)) return;
  const deviceBinding = getCountableDeviceBindingByDeviceId(deviceId);
  if (deviceBinding && deviceBinding.user_id !== user.id) {
    res.status(403).json({
      error: `este dispositivo ya está vinculado a «${deviceBinding.username}»; solo puedes entrar con esa cuenta aquí`,
    });
    return;
  }
  if (!isPrivadasUser(user.id) && !user.is_admin && !deviceBinding) {
    bindDeviceToUser(deviceId, user.id);
  }
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/arena/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get("/api/arena/auth/me", requireAuth, (req, res) => {
  const user = findUserById(req.userId);
  if (!user) {
    res.status(401).json({ error: "usuario no encontrado" });
    return;
  }
  res.json({ user: publicUser(user) });
});

// ── Predicciones propias (solo el usuario autenticado) ──────────────────────

app.get("/api/arena/me/predictions", requireAuth, (req, res) => {
  const { data, updatedAt } = getUserPredictions(req.userId);
  res.json({ predictions: data, updatedAt });
});

app.delete("/api/arena/me", requireAuth, (req, res) => {
  if (isPrivadasUser(req.userId)) {
    res.status(403).json({
      error: "cuenta espejo de la quiniela privada; no se puede eliminar desde Arena",
    });
    return;
  }
  const result = deleteUserById(req.userId);
  if (!result.ok) {
    if (result.error === "last_admin") {
      res.status(403).json({
        error: "eres el último administrador; nombra otro admin antes de borrarte",
      });
      return;
    }
    res.status(404).json({ error: "usuario no encontrado" });
    return;
  }
  clearAuthCookie(res);
  invalidateSharedCache();
  res.json({ ok: true });
});

app.get("/api/arena/admin/users", requireAuth, requireAdmin, (_req, res) => {
  res.json({ users: listArenaUsersForAdmin() });
});

app.get("/api/arena/admin/users/search", requireAuth, requireAdmin, (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const norm = q.toLowerCase();
  let users = listArenaUsersForAdmin();
  if (norm.length >= 1) {
    users = users.filter(
      (u) =>
        u.username.toLowerCase().includes(norm) ||
        String(u.displayName ?? "")
          .toLowerCase()
          .includes(norm),
    );
  }
  res.json({ users: users.slice(0, 80) });
});

app.post("/api/arena/admin/users/:username/ban", requireAuth, requireAdmin, (req, res) => {
  const username = String(req.params.username ?? "")
    .trim()
    .toLowerCase();
  const target = findUserByUsername(username);
  if (!target) {
    res.status(404).json({ error: "usuario no encontrado" });
    return;
  }
  if (target.id === req.userId) {
    res.status(403).json({ error: "no puedes banearte a ti mismo" });
    return;
  }
  const result = banArenaUserById(target.id, req.userId);
  if (!result.ok) {
    if (result.error === "last_admin") {
      res.status(403).json({ error: "no se puede banear al último administrador" });
      return;
    }
    res.status(404).json({ error: "usuario no encontrado" });
    return;
  }
  invalidateSharedCache();
  res.json({
    ok: true,
    username: result.username,
    deviceBanned: result.deviceBanned,
  });
});

app.get("/api/arena/admin/backups", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const backups = await listArenaBackupFiles();
    res.json({ ok: true, maxBackups: getArenaMaxBackups(), backups });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "no se pudo listar backups" });
  }
});

app.get("/api/arena/admin/backups/export", requireAuth, requireAdmin, (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(createArenaBackupEnvelopeNow());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "no se pudo exportar backup" });
  }
});

app.get("/api/arena/admin/backups/:filename", requireAuth, requireAdmin, async (req, res) => {
  const raw = await readArenaBackupFile(req.params.filename);
  if (!raw) {
    res.status(404).json({ error: "backup no encontrado" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.type("application/json").send(JSON.stringify(raw));
});

app.post("/api/arena/admin/backups/restore/:filename", requireAuth, requireAdmin, async (req, res) => {
  const filename = String(req.params.filename ?? "");
  const raw = await readArenaBackupFile(filename);
  if (!raw) {
    res.status(404).json({ error: "backup no encontrado" });
    return;
  }
  const result = await restoreArenaFromBackupPayload(raw, filename);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  invalidateSharedCache();
  res.json({ ok: true, restoredFrom: result.restoredFrom, preRestoreBackup: result.preRestoreBackup });
});

app.post("/api/arena/admin/backups/restore", requireAuth, requireAdmin, async (req, res) => {
  const result = await restoreArenaFromBackupPayload(req.body, "upload");
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  invalidateSharedCache();
  res.json({ ok: true, restoredFrom: result.restoredFrom, preRestoreBackup: result.preRestoreBackup });
});

app.delete("/api/arena/admin/users/:username", requireAuth, requireAdmin, (req, res) => {
  const username = String(req.params.username ?? "")
    .trim()
    .toLowerCase();
  const target = findUserByUsername(username);
  if (!target) {
    res.status(404).json({ error: "usuario no encontrado" });
    return;
  }
  const result = deleteUserById(target.id);
  if (!result.ok) {
    if (result.error === "last_admin") {
      res.status(403).json({ error: "no se puede eliminar al último administrador" });
      return;
    }
    res.status(404).json({ error: "usuario no encontrado" });
    return;
  }
  invalidateSharedCache();
  res.json({ ok: true, username: result.username });
});

app.put("/api/arena/me/predictions", requireAuth, (req, res) => {
  if (isPrivadasUser(req.userId)) {
    res.status(403).json({
      error: "predicciones de la quiniela privada: edítalas en Predicciones Amigos, no en Arena",
    });
    return;
  }
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "body inválido" });
    return;
  }
  const normalized = normalizePredictionsData(req.body);
  const saved = setUserPredictions(req.userId, normalized);
  invalidateSharedCache();
  res.json({ ok: true, predictions: saved.data, updatedAt: saved.updatedAt });
});

// ── Datos compartidos (lectura con cache; sin empujar a otros clientes) ─────

app.get("/api/arena/official", (_req, res) => {
  const now = Date.now();
  if (!sharedCache.official.data || now - sharedCache.official.at > SHARED_CACHE_MS) {
    const { data, updatedAt } = getOfficialResults();
    sharedCache.official = { data: { official: data, updatedAt }, etag: bumpEtag(), at: now };
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("ETag", sharedCache.official.etag);
  const matchVoteData = getCachedArenaMatchVoteData(SHARED_CACHE_MS);
  res.json({ ...sharedCache.official.data, matchVoteData });
});

app.get("/api/arena/rankings", requireAuth, (req, res) => {
  const me = findUserById(req.userId);
  const viewerUsername = me?.username ?? "";
  const { data, etag } = getCachedArenaRankings(viewerUsername, SHARED_CACHE_MS);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("ETag", etag);
  res.json(data);
});

app.get("/api/arena/predictions/search", requireAuth, (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.status(400).json({ error: "escribe al menos 2 caracteres para buscar" });
    return;
  }
  const predictions = searchPredictionsByQuery(q, 25);
  const users = searchUsersByQuery(q, 25).map((u) => ({
    username: u.username,
    displayName: u.display_name,
  }));
  res.setHeader("Cache-Control", "no-store");
  res.json({ users, predictions, query: q });
});

app.put("/api/arena/admin/official", requireAuth, requireAdmin, (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ error: "body inválido" });
    return;
  }
  const normalized = normalizeOfficialResultsData(req.body);
  const saved = saveArenaOfficial(normalized);
  invalidateSharedCache();
  res.json({ ok: true, official: saved.data, updatedAt: saved.updatedAt });
});

app.post("/api/arena/internal/sync-privadas", (req, res) => {
  if (!isSyncSecretValid(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  void syncPrivadasToArena(invalidateSharedCache)
    .then((ok) => res.json({ ok: Boolean(ok) }))
    .catch((e) => {
      console.error(e);
      res.status(500).json({ error: "sync privadas fallido" });
    });
});

app.post("/api/arena/internal/sync-official", (req, res) => {
  if (!isSyncSecretValid(req)) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const { official, updatedAt } = req.body ?? {};
  if (!official || typeof official !== "object") {
    res.status(400).json({ error: "official requerido" });
    return;
  }
  const changed = applyOfficialFromPrivadasIfNewer(official, updatedAt, invalidateSharedCache);
  res.json({ ok: true, changed });
});

app.get("/api/arena/chat/messages", requireAuth, (req, res) => {
  const sinceId = Number(req.query.sinceId ?? 0);
  const messages = getChatMessagesSince(sinceId);
  res.json({
    messages,
    latestId: getLatestChatMessageId(),
  });
});

app.post("/api/arena/chat/messages", requireAuth, (req, res) => {
  const body = sanitizeChatBody(req.body?.body ?? req.body?.text ?? "");
  if (!body) {
    res.status(400).json({ error: "escribe un mensaje" });
    return;
  }
  const userId = Number(req.userId);
  const limit = checkChatRateLimit(userId, body);
  if (!limit.ok) {
    const msg =
      limit.reason === "duplicate"
        ? `Repetiste el mismo mensaje. Espera ${limit.retryAfterSec}s.`
        : `Espera ${limit.retryAfterSec}s antes de enviar otro mensaje.`;
    res.setHeader("Retry-After", String(limit.retryAfterSec));
    res.status(429).json({ error: msg, retryAfterSec: limit.retryAfterSec, reason: limit.reason });
    return;
  }
  recordChatSend(userId, body);
  const message = insertChatMessage(userId, body);
  res.status(201).json({ ok: true, message });
});

app.get("/api/arena/chat/limits", requireAuth, (_req, res) => {
  res.json({
    cooldownSec: Number(process.env.ARENA_CHAT_COOLDOWN_MS || 5000) / 1000,
    duplicateCooldownSec: Number(process.env.ARENA_CHAT_DUP_COOLDOWN_MS || 60_000) / 1000,
    maxLen: CHAT_MAX_LEN,
  });
});

app.get("/api/arena/sync", requireAuth, (req, res) => {
  const { data: official, updatedAt } = getOfficialResults();
  const me = findUserById(req.userId);
  const myUsername = me?.username ?? "";
  const mine = getUserPredictions(req.userId);
  const previewPredictions = getPreviewPredictionsByUsername(myUsername, PREVIEW_PREDICTIONS_LIMIT);
  /** @type {Record<string, object>} */
  const predictions = { ...previewPredictions };
  if (myUsername) {
    predictions[myUsername] = mine.data;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    participants: getAllArenaParticipants(),
    official,
    officialUpdatedAt: updatedAt,
    predictions,
    totalParticipants: countCompetingUsers(),
    previewLimit: PREVIEW_PREDICTIONS_LIMIT,
    matchVoteData: getCachedArenaMatchVoteData(SHARED_CACHE_MS),
  });
});

app.get("/api/arena/health", (_req, res) => {
  res.json({ ok: true, users: countArenaUsers(), maxUsers: MAX_USERS });
});

// ── Static prod (solo con --serve-static, p. ej. npm run start:arena) ───────

if (SERVE_STATIC && fs.existsSync(DIST_DIR)) {
  const ARENA_STATIC = path.join(DIST_DIR, "ArenaMundial");
  app.use("/ArenaMundial", express.static(ARENA_STATIC));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!req.path.startsWith("/ArenaMundial")) return next();
    const rel = req.path.replace(/^\/ArenaMundial\/?/, "");
    if (rel === "" || rel === "login" || rel === "login/") {
      res.sendFile(path.join(ARENA_STATIC, "login/index.html"));
      return;
    }
    if (rel === "app" || rel === "app/") {
      res.sendFile(path.join(ARENA_STATIC, "app/index.html"));
      return;
    }
    next();
  });
} else if (!SERVE_STATIC) {
  app.get(/^\/ArenaMundial(\/.*)?$/, (_req, res) => {
    res.status(503).type("text/plain; charset=utf-8").send(
      "Arena API (solo backend).\n\n" +
        "En desarrollo abre el frontend en Vite:\n" +
        "  http://localhost:5174/ArenaMundial/login/\n\n" +
        "Producción: npm run start:arena (compila y sirve HTML en este puerto).",
    );
  });
}

initDb();
setArenaDataChangedHandler(scheduleArenaBackup);

startPrivadasSyncPoll(invalidateSharedCache);

startOfficialKickoffPoll({
  onChange() {
    invalidateSharedCache();
  },
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[arena] API en http://localhost:${PORT} (máx. ${MAX_USERS} usuarios)`);
  console.log("[arena] Sin WebSocket: cada cliente solo recibe sus propios cambios.");
  if (SERVE_STATIC && fs.existsSync(DIST_DIR)) {
    console.log(`[arena] Sirviendo frontend compilado → http://localhost:${PORT}/ArenaMundial/login/`);
  } else {
    console.log("[arena] Solo API. Frontend dev → http://localhost:5174/ArenaMundial/login/  (npm run dev:arena)");
  }
});

server.on("error", (err) => {
  if (err && typeof err === "object" && "code" in err && err.code === "EADDRINUSE") {
    console.error(`[arena] Puerto ${PORT} ya en uso (hay otra instancia corriendo).`);
    console.error(`[arena] Windows: netstat -ano | findstr :${PORT}  →  taskkill /PID <n> /F`);
    console.error(`[arena] O usa otro puerto: set ARENA_PORT=8789 && npm run server:arena`);
    process.exit(1);
  }
  throw err;
});
