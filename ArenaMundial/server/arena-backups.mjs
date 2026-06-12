/**
 * Copias de seguridad de Arena (JSON en disco, mismo enfoque que la quiniela privada).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exportArenaBackupData, restoreArenaFromBackupData } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.ARENA_DATA_DIR || path.join(__dirname, "data");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const MAX_BACKUPS = Number(process.env.ARENA_MAX_BACKUPS || 50);
const BACKUP_MIN_INTERVAL_MS = Number(process.env.ARENA_BACKUP_INTERVAL_MS || 5 * 60 * 1000);

export const ARENA_BACKUP_VERSION = 1;

/** @type {string} */
let lastBackupContentHash = "";
/** @type {number} */
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
  const jsonFiles = files.filter((f) => /^arena-.+\.json$/.test(f)).sort();
  while (jsonFiles.length > MAX_BACKUPS) {
    const oldest = jsonFiles.shift();
    if (!oldest) break;
    await fs.promises.unlink(path.join(BACKUPS_DIR, oldest)).catch(() => {});
  }
}

/**
 * @param {ReturnType<typeof exportArenaBackupData>} data
 */
export function buildArenaBackupEnvelope(data) {
  return {
    backupVersion: ARENA_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "arena",
    data,
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof exportArenaBackupData> | null}
 */
export function extractArenaBackupData(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const data =
    obj.data && typeof obj.data === "object"
      ? /** @type {Record<string, unknown>} */ (obj.data)
      : obj;
  if (!Array.isArray(data.users) || !data.official || typeof data.official !== "object") {
    return null;
  }
  return /** @type {ReturnType<typeof exportArenaBackupData>} */ (data);
}

export function getArenaBackupsDir() {
  return BACKUPS_DIR;
}

export function getArenaMaxBackups() {
  return MAX_BACKUPS;
}

export function createArenaBackupEnvelopeNow() {
  return buildArenaBackupEnvelope(exportArenaBackupData());
}

export async function writeArenaBackupFile(envelope, filenamePrefix = "arena") {
  await fs.promises.mkdir(BACKUPS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `${filenamePrefix}-${ts}.json`;
  const json = JSON.stringify(envelope);
  await fs.promises.writeFile(path.join(BACKUPS_DIR, name), json, "utf8");
  await pruneOldBackups();
  return name;
}

export async function maybeCreateArenaBackup() {
  const envelope = createArenaBackupEnvelopeNow();
  const json = JSON.stringify(envelope);
  const hash = hashContent(json);
  if (hash === lastBackupContentHash) return null;
  const now = Date.now();
  if (now - lastBackupAt < BACKUP_MIN_INTERVAL_MS) return null;
  lastBackupContentHash = hash;
  lastBackupAt = now;
  return writeArenaBackupFile(envelope);
}

export function scheduleArenaBackup() {
  void maybeCreateArenaBackup().catch((e) => {
    console.error("[arena] backup automático:", e instanceof Error ? e.message : e);
  });
}

/** Copia de seguridad inmediata (p. ej. antes de restaurar). */
export async function createArenaBackupNow(prefix = "arena-pre-restore") {
  const envelope = createArenaBackupEnvelopeNow();
  const name = await writeArenaBackupFile(envelope, prefix);
  lastBackupContentHash = hashContent(JSON.stringify(envelope));
  lastBackupAt = Date.now();
  return name;
}

export async function listArenaBackupFiles() {
  await fs.promises.mkdir(BACKUPS_DIR, { recursive: true });
  const files = await fs.promises.readdir(BACKUPS_DIR);
  /** @type {Array<{ filename: string, size: number, createdAt: string }>} */
  const items = [];
  for (const name of files.filter((f) => /^arena-.+\.json$/.test(f)).sort().reverse()) {
    const stat = await fs.promises.stat(path.join(BACKUPS_DIR, name));
    items.push({
      filename: name,
      size: stat.size,
      createdAt: stat.mtime.toISOString(),
    });
  }
  return items;
}

export function resolveArenaBackupPath(filename) {
  const name = path.basename(String(filename ?? ""));
  if (!/^arena-.+\.json$/.test(name)) return null;
  const filePath = path.join(BACKUPS_DIR, name);
  if (!filePath.startsWith(BACKUPS_DIR)) return null;
  return filePath;
}

export async function readArenaBackupFile(filename) {
  const filePath = resolveArenaBackupPath(filename);
  if (!filePath) return null;
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} raw
 * @returns {Promise<{ ok: true, restoredFrom: string, preRestoreBackup?: string } | { ok: false, error: string }>}
 */
export async function restoreArenaFromBackupPayload(raw, restoredFromLabel = "upload") {
  const data = extractArenaBackupData(raw);
  if (!data) return { ok: false, error: "backup corrupto o formato inválido" };
  let preRestoreBackup;
  try {
    preRestoreBackup = await createArenaBackupNow("arena-pre-restore");
  } catch (e) {
    console.error("[arena] backup pre-restauración:", e);
  }
  try {
    restoreArenaFromBackupData(data);
    lastBackupContentHash = "";
    return { ok: true, restoredFrom: restoredFromLabel, preRestoreBackup };
  } catch (e) {
    console.error("[arena] restauración:", e);
    return { ok: false, error: "restauración fallida" };
  }
}
