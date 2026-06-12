/**
 * SQLite para la versión pública (~10k usuarios).
 * Cada usuario tiene sus predicciones aisladas; resultados oficiales compartidos.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { emptyOfficialResults } from "../../src/official-results-store.js";
import { emptyPredictions } from "../../src/predictions-store.js";
import { normalizeForSearch } from "../../src/search-normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.ARENA_DATA_DIR || path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "arena.db");

/** @type {import("better-sqlite3").Database | null} */
let db = null;

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
  return getUserPredictions(userId);
}

export function findUserByUsername(username) {
  return getDb()
    .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .get(username);
}

/** Usuario o nombre visible ya usado (sin distinguir mayúsculas). */
export function isPublicNameTaken(name) {
  const n = String(name ?? "").trim();
  if (!n) return false;
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM users
         WHERE username = ? COLLATE NOCASE OR display_name = ? COLLATE NOCASE
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
  setUserPredictions(userId, emptyPredictions());
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
  return { ok: true, username: user.username };
}

/** @param {string} deviceId */
export function getDeviceBindingByDeviceId(deviceId) {
  return (
    getDb()
      .prepare(
        `SELECT db.device_id, db.user_id, u.username, u.display_name, u.is_privadas
         FROM device_bindings db
         JOIN users u ON u.id = db.user_id
         WHERE db.device_id = ?`,
      )
      .get(deviceId) ?? null
  );
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
    .prepare(`SELECT username, display_name, is_admin FROM users ORDER BY id ASC`)
    .all()
    .map((row) => ({
      id: row.username,
      name: row.display_name,
      pin: null,
    }));
}

export function getAllPredictionsByUsername() {
  const rows = getDb()
    .prepare(
      `SELECT u.username, p.data
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id`,
    )
    .all();
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
