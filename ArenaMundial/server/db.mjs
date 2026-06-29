/**
 * SQLite para la versión pública (~10k usuarios).
 * Cada usuario tiene sus predicciones aisladas; resultados oficiales compartidos.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { emptyOfficialResults, normalizeOfficialResultsData } from "../../src/official-results-store.js";
import { emptyPredictions, normalizePredictionsData } from "../../src/predictions-store.js";
import { normalizeForSearch } from "../../src/search-normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ARENA_DATA_DIR = process.env.ARENA_DATA_DIR || path.join(__dirname, "data");
const DATA_DIR = ARENA_DATA_DIR;
const DB_PATH = path.join(DATA_DIR, "arena.db");

/** @type {import("better-sqlite3").Database | null} */
let db = null;

/** @type {(() => void) | null} */
let arenaDataChangedHandler = null;

export function setArenaDataChangedHandler(fn) {
  arenaDataChangedHandler = typeof fn === "function" ? fn : null;
}

function notifyArenaDataChanged() {
  try {
    arenaDataChangedHandler?.();
  } catch (e) {
    console.error("[arena] notify data changed:", e);
  }
}

export function getDb() {
  if (!db) throw new Error("DB no inicializada");
  return db;
}

export function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      email TEXT COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS predictions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS official (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_predictions_updated ON predictions(updated_at);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_id ON chat_messages(id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

    CREATE TABLE IF NOT EXISTS device_bindings (
      device_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bound_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_device_bindings_user ON device_bindings(user_id);

    CREATE TABLE IF NOT EXISTS device_bans (
      device_id TEXT PRIMARY KEY,
      banned_at TEXT NOT NULL DEFAULT (datetime('now')),
      banned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      note TEXT
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name
    ON users(display_name COLLATE NOCASE);
  `);

  const userCols = db.prepare("PRAGMA table_info(users)").all();
  if (!userCols.some((c) => c.name === "is_privadas")) {
    db.exec("ALTER TABLE users ADD COLUMN is_privadas INTEGER NOT NULL DEFAULT 0");
  }

  const officialRow = db.prepare("SELECT data FROM official WHERE id = 1").get();
  if (!officialRow) {
    db.prepare("INSERT INTO official (id, data) VALUES (1, ?)").run(
      JSON.stringify(emptyOfficialResults()),
    );
  }

  return db;
}

export function getOfficialResults() {
  const row = getDb().prepare("SELECT data, updated_at FROM official WHERE id = 1").get();
  return {
    data: JSON.parse(row?.data ?? "{}"),
    updatedAt: row?.updated_at ?? null,
  };
}

export function setOfficialResults(data) {
  return setOfficialResultsWithUpdatedAt(data, new Date().toISOString());
}

/** @param {unknown} data @param {string | null | undefined} updatedAt */
export function setOfficialResultsWithUpdatedAt(data, updatedAt) {
  const json = JSON.stringify(data);
  const at = toOfficialTimestamp(updatedAt);
  getDb().prepare("UPDATE official SET data = ?, updated_at = ? WHERE id = 1").run(json, at);
  notifyArenaDataChanged();
  return getOfficialResults();
}

/** @param {string | null | undefined} value */
function toOfficialTimestamp(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function getUserPredictions(userId) {
  const row = getDb()
    .prepare("SELECT data, updated_at FROM predictions WHERE user_id = ?")
    .get(userId);
  if (!row) {
    return { data: emptyPredictions(), updatedAt: null };
  }
  return { data: JSON.parse(row.data), updatedAt: row.updated_at };
}

export function setUserPredictions(userId, data) {
  const json = JSON.stringify(data);
  getDb()
    .prepare(
      `INSERT INTO predictions (user_id, data, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .run(userId, json);
  notifyArenaDataChanged();
  return getUserPredictions(userId);
}

export function findUserByUsername(username) {
  return getDb()
    .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .get(username);
}

/** Usuario o nombre visible ya usado por una cuenta Arena (no espejos de privadas). */
export function isPublicNameTaken(name) {
  const n = String(name ?? "").trim();
  if (!n) return false;
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM users
         WHERE is_privadas = 0
           AND (username = ? COLLATE NOCASE OR display_name = ? COLLATE NOCASE)
         LIMIT 1`,
      )
      .get(n, n),
  );
}

export function findUserById(id) {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function createUser({ username, passwordHash, displayName, isAdmin = false, isPrivadas = false }) {
  const result = getDb()
    .prepare(
      `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_privadas)
       VALUES (?, NULL, ?, ?, ?, ?)`,
    )
    .run(username, passwordHash, displayName, isAdmin ? 1 : 0, isPrivadas ? 1 : 0);
  const userId = Number(result.lastInsertRowid);
  const empty = emptyPredictions();
  getDb()
    .prepare(
      `INSERT INTO predictions (user_id, data, updated_at)
       VALUES (?, ?, datetime('now'))`,
    )
    .run(userId, JSON.stringify(empty));
  notifyArenaDataChanged();
  return findUserById(userId);
}

export function updateUserPassword(userId, passwordHash) {
  getDb()
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(passwordHash, userId);
}

/**
 * Crea o actualiza un jugador espejo de la quiniela privada.
 * @param {{ username: string, passwordHash: string, displayName: string }} opts
 */
export function upsertPrivadasUser({ username, passwordHash, displayName }) {
  const existing = findUserByUsername(username);
  if (existing) {
    getDb()
      .prepare(
        `UPDATE users SET password_hash = ?, display_name = ?, is_privadas = 1 WHERE id = ?`,
      )
      .run(passwordHash, displayName, existing.id);
    notifyArenaDataChanged();
    return findUserById(existing.id);
  }
  return createUser({
    username,
    passwordHash,
    displayName,
    isAdmin: false,
    isPrivadas: true,
  });
}

export function isPrivadasUser(userId) {
  const row = findUserById(userId);
  return Boolean(row?.is_privadas);
}

export function countUsers() {
  return /** @type {{ n: number }} */ (getDb().prepare("SELECT COUNT(*) AS n FROM users").get()).n;
}

/** Cuentas Arena propias (excluye espejos sincronizados desde la quiniela privada). */
export function countArenaUsers() {
  return /** @type {{ n: number }} */ (
    getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE is_privadas = 0").get()
  ).n;
}

export function countCompetingUsers() {
  return /** @type {{ n: number }} */ (
    getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 0").get()
  ).n;
}

export function countAdmins() {
  return /** @type {{ n: number }} */ (
    getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").get()
  ).n;
}

/**
 * @param {number} userId
 * @returns {{ ok: true, username: string } | { ok: false, error: "not_found" | "last_admin" }}
 */
export function deleteUserById(userId) {
  const user = findUserById(userId);
  if (!user) return { ok: false, error: "not_found" };
  if (user.is_admin && countAdmins() <= 1) {
    return { ok: false, error: "last_admin" };
  }
  getDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
  notifyArenaDataChanged();
  return { ok: true, username: user.username };
}

/** @param {string} deviceId */
export function getDeviceBindingByDeviceId(deviceId) {
  return (
    getDb()
      .prepare(
        `SELECT db.device_id, db.user_id, u.username, u.display_name, u.is_privadas, u.is_admin
         FROM device_bindings db
         JOIN users u ON u.id = db.user_id
         WHERE db.device_id = ?`,
      )
      .get(deviceId) ?? null
  );
}

/**
 * Vinculación que aplica la regla «una cuenta Arena por dispositivo».
 * Espejos de privadas y sesiones de admin no cuentan.
 * @param {ReturnType<typeof getDeviceBindingByDeviceId>} binding
 */
export function isCountableDeviceBinding(binding) {
  if (!binding) return false;
  return !binding.is_privadas && !binding.is_admin;
}

/** @param {string} deviceId */
export function getCountableDeviceBindingByDeviceId(deviceId) {
  const binding = getDeviceBindingByDeviceId(deviceId);
  return isCountableDeviceBinding(binding) ? binding : null;
}

/** @param {string} deviceId */
export function isDeviceBanned(deviceId) {
  return Boolean(
    getDb().prepare(`SELECT 1 FROM device_bans WHERE device_id = ? LIMIT 1`).get(deviceId),
  );
}

/** @param {string} deviceId @param {number | null} [bannedByUserId] @param {string} [note] */
export function banDeviceId(deviceId, bannedByUserId = null, note = "") {
  getDb()
    .prepare(
      `INSERT INTO device_bans (device_id, banned_by_user_id, note)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         banned_at = datetime('now'),
         banned_by_user_id = excluded.banned_by_user_id,
         note = excluded.note`,
    )
    .run(deviceId, bannedByUserId, note || null);
}

/** @param {number} userId */
export function getDeviceIdForUser(userId) {
  const row = getDb()
    .prepare(`SELECT device_id FROM device_bindings WHERE user_id = ?`)
    .get(userId);
  return row?.device_id ?? null;
}

/**
 * Banea el dispositivo vinculado y elimina la cuenta.
 * @param {number} userId
 * @param {number} bannedByUserId
 */
export function banArenaUserById(userId, bannedByUserId) {
  const user = findUserById(userId);
  if (!user) return { ok: false, error: "not_found" };
  if (user.is_admin && countAdmins() <= 1) {
    return { ok: false, error: "last_admin" };
  }
  const deviceId = getDeviceIdForUser(userId);
  if (deviceId) {
    banDeviceId(deviceId, bannedByUserId, `usuario:${user.username}`);
  }
  const deleted = deleteUserById(userId);
  if (!deleted.ok) return deleted;
  return { ok: true, username: user.username, deviceBanned: Boolean(deviceId) };
}

export function listArenaUsersForAdmin() {
  return getDb()
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.is_admin, u.is_privadas, u.created_at,
              db.device_id,
              EXISTS(SELECT 1 FROM device_bans b WHERE b.device_id = db.device_id) AS device_banned
       FROM users u
       LEFT JOIN device_bindings db ON db.user_id = u.id
       ORDER BY u.display_name COLLATE NOCASE, u.username COLLATE NOCASE`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      isAdmin: Boolean(row.is_admin),
      isPrivadas: Boolean(row.is_privadas),
      createdAt: row.created_at,
      deviceBanned: Boolean(row.device_banned),
      hasDevice: Boolean(row.device_id),
    }));
}

/** @param {string} deviceId @param {number} userId */
export function bindDeviceToUser(deviceId, userId) {
  getDb()
    .prepare(
      `INSERT INTO device_bindings (device_id, user_id)
       VALUES (?, ?)
       ON CONFLICT(device_id) DO UPDATE SET user_id = excluded.user_id, bound_at = datetime('now')`,
    )
    .run(deviceId, userId);
}

/**
 * Registro atómico: crea usuario y vincula dispositivo, o no hace nada si ya hay vínculo.
 * @param {{ username: string, passwordHash: string, displayName: string, isAdmin?: boolean, deviceId: string }}
 * @returns {{ ok: true, user: ReturnType<typeof findUserById> } | { ok: false, error: "device_bound", username: string }}
 */
export function registerArenaUserWithDevice({ username, passwordHash, displayName, isAdmin = false, deviceId }) {
  const database = getDb();
  const run = database.transaction(() => {
    const existing = getCountableDeviceBindingByDeviceId(deviceId);
    if (existing) {
      return { ok: false, error: "device_bound", username: existing.username };
    }
    const result = database
      .prepare(
        `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_privadas)
         VALUES (?, NULL, ?, ?, ?, 0)`,
      )
      .run(username, passwordHash, displayName, isAdmin ? 1 : 0);
    const userId = Number(result.lastInsertRowid);
    setUserPredictions(userId, emptyPredictions());
    bindDeviceToUser(deviceId, userId);
    return { ok: true, user: findUserById(userId) };
  });
  return run();
}

/**
 * @param {string} query
 * @param {number} [limit]
 */
export function searchUsersByQuery(query, limit = 25) {
  const q = normalizeForSearch(query);
  if (!q || q.length < 2) return [];
  const lim = Math.max(1, Math.min(50, Number(limit) || 25));
  return getDb()
    .prepare(`SELECT id, username, display_name, is_admin FROM users`)
    .all()
    .filter(
      (row) =>
        normalizeForSearch(row.username).includes(q) ||
        normalizeForSearch(row.display_name).includes(q),
    )
    .sort((a, b) =>
      normalizeForSearch(a.display_name).localeCompare(normalizeForSearch(b.display_name), "es", {
        sensitivity: "base",
      }),
    )
    .slice(0, lim);
}

export function getAllArenaParticipants() {
  return getDb()
    .prepare(
      `SELECT username, display_name, is_privadas FROM users
       WHERE is_admin = 0
       ORDER BY id ASC`,
    )
    .all()
    .map((row) => ({
      id: row.username,
      name: row.display_name,
      pin: null,
      isPrivadas: Boolean(row.is_privadas),
    }));
}

export function getAllPredictionsByUsername() {
  const rows = getDb()
    .prepare(
      `SELECT u.username, p.data
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       WHERE u.is_admin = 0`,
    )
    .all();
  return predictionsRowsToMap(rows);
}

/** @param {Array<{ username: string, data: string | null }>} rows */
function predictionsRowsToMap(rows) {
  /** @type {Record<string, object>} */
  const map = {};
  for (const row of rows) {
    try {
      map[row.username] = JSON.parse(row.data ?? "{}");
    } catch {
      map[row.username] = emptyPredictions();
    }
  }
  return map;
}

/**
 * Vista previa para tablas: jugadores con predicciones actualizadas recientemente.
 * @param {string | null | undefined} excludeUsername
 * @param {number} [limit]
 */
export function getPreviewPredictionsByUsername(excludeUsername, limit = 49) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 49));
  const ex = String(excludeUsername ?? "").trim().toLowerCase();
  const rows = getDb()
    .prepare(
      `SELECT u.username, p.data
       FROM users u
       INNER JOIN predictions p ON p.user_id = u.id
       WHERE u.is_admin = 0
         AND (? = '' OR u.username != ? COLLATE NOCASE)
       ORDER BY p.updated_at DESC, u.id ASC
       LIMIT ?`,
    )
    .all(ex, ex, lim);
  return predictionsRowsToMap(rows);
}

/**
 * Búsqueda por nombre/usuario con predicciones (mín. 2 caracteres en el handler).
 * @param {string} query
 * @param {number} [limit]
 */
export function searchPredictionsByQuery(query, limit = 25) {
  const users = searchUsersByQuery(query, limit);
  if (users.length === 0) return {};
  const usernames = users.map((u) => u.username);
  const placeholders = usernames.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT u.username, p.data
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       WHERE u.username IN (${placeholders}) AND u.is_admin = 0`,
    )
    .all(...usernames);
  return predictionsRowsToMap(rows);
}

/** Ranking ligero: lista ordenada por actividad (puntuación completa se calculará en el cliente). */
export function getRankingsSummary(limit = 100) {
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.username, u.display_name, p.updated_at
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       WHERE u.is_admin = 0
       ORDER BY p.updated_at IS NULL, p.updated_at DESC, u.id ASC
       LIMIT ?`,
    )
    .all(limit);
  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.id,
    username: row.username,
    displayName: row.display_name,
    updatedAt: row.updated_at,
  }));
}

const CHAT_KEEP_ROWS = Number(process.env.ARENA_CHAT_KEEP_ROWS || 200);
const CHAT_FETCH_MAX = Number(process.env.ARENA_CHAT_FETCH_MAX || 120);

/**
 * @param {number} userId
 * @param {string} body
 */
export function insertChatMessage(userId, body) {
  const db = getDb();
  const result = db
    .prepare(`INSERT INTO chat_messages (user_id, body) VALUES (?, ?)`)
    .run(userId, body);
  const id = Number(result.lastInsertRowid);
  pruneOldChatMessages();
  notifyArenaDataChanged();
  return getChatMessageById(id);
}

function pruneOldChatMessages() {
  getDb()
    .prepare(
      `DELETE FROM chat_messages WHERE id NOT IN (
         SELECT id FROM chat_messages ORDER BY id DESC LIMIT ?
       )`,
    )
    .run(CHAT_KEEP_ROWS);
}

function getChatMessageById(id) {
  const row = getDb()
    .prepare(
      `SELECT m.id, m.body, m.created_at, u.username, u.display_name
       FROM chat_messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`,
    )
    .get(id);
  if (!row) return null;
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    username: row.username,
    displayName: row.display_name,
  };
}

/**
 * @param {number} [sinceId] mensajes con id > sinceId (incremental)
 * @param {number} [limit]
 */
export function getChatMessagesSince(sinceId = 0, limit = CHAT_FETCH_MAX) {
  const since = Math.max(0, Number(sinceId) || 0);
  const lim = Math.max(1, Math.min(CHAT_FETCH_MAX, Number(limit) || CHAT_FETCH_MAX));
  if (since > 0) {
    return getDb()
      .prepare(
        `SELECT m.id, m.body, m.created_at, u.username, u.display_name
         FROM chat_messages m
         JOIN users u ON u.id = m.user_id
         WHERE m.id > ?
         ORDER BY m.id ASC
         LIMIT ?`,
      )
      .all(since, lim)
      .map(mapChatRow);
  }
  return getDb()
    .prepare(
      `SELECT m.id, m.body, m.created_at, u.username, u.display_name
       FROM chat_messages m
       JOIN users u ON u.id = m.user_id
       ORDER BY m.id DESC
       LIMIT ?`,
    )
    .all(lim)
    .map(mapChatRow)
    .reverse();
}

/** @param {object} row */
function mapChatRow(row) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    username: row.username,
    displayName: row.display_name,
  };
}

export function getLatestChatMessageId() {
  const row = getDb().prepare(`SELECT MAX(id) AS n FROM chat_messages`).get();
  return Number(row?.n ?? 0);
}

export function exportArenaBackupData() {
  const database = getDb();
  const { data: official, updatedAt: officialUpdatedAt } = getOfficialResults();
  const users = database
    .prepare(
      `SELECT u.username, u.display_name, u.is_admin, u.is_privadas, u.password_hash, u.created_at,
              p.data AS predictions_json, p.updated_at AS predictions_updated_at
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       ORDER BY u.id ASC`,
    )
    .all()
    .map((row) => {
      let predictions = emptyPredictions();
      if (row.predictions_json) {
        try {
          predictions = normalizePredictionsData(JSON.parse(row.predictions_json));
        } catch {
          predictions = emptyPredictions();
        }
      }
      return {
        username: row.username,
        displayName: row.display_name,
        isAdmin: Boolean(row.is_admin),
        isPrivadas: Boolean(row.is_privadas),
        passwordHash: row.password_hash,
        createdAt: row.created_at,
        predictions,
        predictionsUpdatedAt: row.predictions_updated_at ?? null,
      };
    });

  const deviceBindings = database
    .prepare(
      `SELECT db.device_id, u.username
       FROM device_bindings db
       INNER JOIN users u ON u.id = db.user_id`,
    )
    .all()
    .map((row) => ({
      deviceId: row.device_id,
      username: row.username,
    }));

  const deviceBans = database
    .prepare(
      `SELECT b.device_id, b.banned_at, b.note, u.username AS banned_by_username
       FROM device_bans b
       LEFT JOIN users u ON u.id = b.banned_by_user_id`,
    )
    .all()
    .map((row) => ({
      deviceId: row.device_id,
      bannedAt: row.banned_at,
      note: row.note ?? null,
      bannedByUsername: row.banned_by_username ?? null,
    }));

  const chatMessages = database
    .prepare(
      `SELECT m.body, m.created_at, u.username
       FROM chat_messages m
       INNER JOIN users u ON u.id = m.user_id
       ORDER BY m.id ASC`,
    )
    .all()
    .map((row) => ({
      username: row.username,
      body: row.body,
      createdAt: row.created_at,
    }));

  return {
    official,
    officialUpdatedAt,
    users,
    deviceBindings,
    deviceBans,
    chatMessages,
  };
}

/**
 * @param {ReturnType<typeof exportArenaBackupData>} payload
 */
export function restoreArenaFromBackupData(payload) {
  const official = normalizeOfficialResultsData(payload.official ?? emptyOfficialResults());
  const officialUpdatedAt =
    typeof payload.officialUpdatedAt === "string" && payload.officialUpdatedAt
      ? payload.officialUpdatedAt
      : new Date().toISOString();
  const users = Array.isArray(payload.users) ? payload.users : [];
  if (users.length === 0) {
    throw new Error("backup sin usuarios");
  }
  if (!users.some((u) => u && !u.isPrivadas && u.isAdmin)) {
    throw new Error("backup sin administrador");
  }

  const database = getDb();
  const run = database.transaction(() => {
    database.prepare("DELETE FROM chat_messages").run();
    database.prepare("DELETE FROM device_bans").run();
    database.prepare("DELETE FROM device_bindings").run();
    database.prepare("DELETE FROM predictions").run();
    database.prepare("DELETE FROM users").run();

    const insertUser = database.prepare(
      `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_privadas, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
    );
    const insertPrediction = database.prepare(
      `INSERT INTO predictions (user_id, data, updated_at)
       VALUES (?, ?, COALESCE(?, datetime('now')))`,
    );
    /** @type {Map<string, number>} */
    const idByUsername = new Map();

    for (const raw of users) {
      const username = String(raw?.username ?? "").trim().toLowerCase();
      const passwordHash = String(raw?.passwordHash ?? "");
      const displayName = String(raw?.displayName ?? raw?.username ?? "").trim() || username;
      if (!username || !passwordHash) continue;
      const result = insertUser.run(
        username,
        passwordHash,
        displayName,
        raw?.isAdmin ? 1 : 0,
        raw?.isPrivadas ? 1 : 0,
        raw?.createdAt ?? null,
      );
      const userId = Number(result.lastInsertRowid);
      idByUsername.set(username, userId);
      const predictions = normalizePredictionsData(raw?.predictions ?? emptyPredictions());
      insertPrediction.run(userId, JSON.stringify(predictions), raw?.predictionsUpdatedAt ?? null);
    }

    database
      .prepare("UPDATE official SET data = ?, updated_at = ? WHERE id = 1")
      .run(JSON.stringify(official), officialUpdatedAt);

    const insertBinding = database.prepare(
      `INSERT INTO device_bindings (device_id, user_id, bound_at)
       VALUES (?, ?, datetime('now'))`,
    );
    for (const raw of Array.isArray(payload.deviceBindings) ? payload.deviceBindings : []) {
      const deviceId = String(raw?.deviceId ?? "");
      const username = String(raw?.username ?? "").trim().toLowerCase();
      const userId = idByUsername.get(username);
      if (!deviceId || !userId) continue;
      insertBinding.run(deviceId, userId);
    }

    const insertBan = database.prepare(
      `INSERT INTO device_bans (device_id, banned_at, banned_by_user_id, note)
       VALUES (?, COALESCE(?, datetime('now')), ?, ?)`,
    );
    for (const raw of Array.isArray(payload.deviceBans) ? payload.deviceBans : []) {
      const deviceId = String(raw?.deviceId ?? "");
      if (!deviceId) continue;
      const bannedBy =
        raw?.bannedByUsername != null
          ? idByUsername.get(String(raw.bannedByUsername).trim().toLowerCase()) ?? null
          : null;
      insertBan.run(deviceId, raw?.bannedAt ?? null, bannedBy, raw?.note ?? null);
    }

    const insertChat = database.prepare(
      `INSERT INTO chat_messages (user_id, body, created_at)
       VALUES (?, ?, COALESCE(?, datetime('now')))`,
    );
    for (const raw of Array.isArray(payload.chatMessages) ? payload.chatMessages : []) {
      const username = String(raw?.username ?? "").trim().toLowerCase();
      const body = String(raw?.body ?? "").trim();
      const userId = idByUsername.get(username);
      if (!userId || !body) continue;
      insertChat.run(userId, body, raw?.createdAt ?? null);
    }
  });
  run();
  notifyArenaDataChanged();
}
