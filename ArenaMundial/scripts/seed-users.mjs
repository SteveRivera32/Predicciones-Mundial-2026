/**
 * Crea usuarios de prueba para Arena (nombres y contraseñas distintos).
 * Uso: node ArenaMundial/scripts/seed-users.mjs
 * Env: ARENA_SEED_COUNT (default 100), ARENA_SEED_PREFIX (default arena_)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, findUserByUsername, createUser, setUserPredictions } from "../server/db.mjs";
import { hashPassword } from "../server/auth.mjs";
import { emptyPredictions } from "../../src/predictions-store.js";
import { GROUPS, GROUP_MATCHES } from "../../src/tournament.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNT = Math.max(1, Math.min(500, Number(process.env.ARENA_SEED_COUNT || 100)));
const PREFIX = String(process.env.ARENA_SEED_PREFIX ?? "arena_").trim().toLowerCase();

const FIRST_NAMES = [
  "Carlos", "María", "Luis", "Ana", "Diego", "Sofía", "Jorge", "Laura", "Miguel", "Elena",
  "Pablo", "Lucía", "Andrés", "Valentina", "Fernando", "Camila", "Ricardo", "Paula", "Héctor", "Natalia",
  "Roberto", "Claudia", "Arturo", "Daniela", "Iván", "Gabriela", "Óscar", "Patricia", "Raúl", "Verónica",
  "Sergio", "Adriana", "Emilio", "Beatriz", "Manuel", "Carmen", "Alberto", "Rosa", "Eduardo", "Silvia",
];

const LAST_NAMES = [
  "García", "Rodríguez", "Martínez", "López", "Hernández", "González", "Pérez", "Sánchez", "Ramírez", "Torres",
  "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Gutiérrez", "Ortiz", "Ruiz",
  "Mendoza", "Vargas", "Castillo", "Ramos", "Herrera", "Medina", "Aguilar", "Vega", "Rojas", "Silva",
];

const PODIUM_TEAMS = ["Brasil", "Argentina", "Francia", "España", "Alemania", "Inglaterra", "Portugal", "México"];

function padNum(n, width) {
  return String(n).padStart(width, "0");
}

/** Contraseña de 8 caracteres única por índice. */
function passwordForIndex(i) {
  const core = padNum(i, 4);
  return `Pw${core}!`;
}

function displayNameForIndex(i) {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length];
  return `${first} ${last} ${padNum(i, 3)}`.trim();
}

function usernameForIndex(i) {
  return `${PREFIX}${padNum(i, 3)}`;
}

/** @param {number} seed */
function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Predicciones variadas pero ligeras (suficiente para probar rankings/tablas).
 * @param {number} index
 */
function buildSeedPredictions(index) {
  const rand = mulberry32(index * 9973 + 42);
  const data = emptyPredictions();

  if (rand() > 0.15) {
    const shuffled = [...PODIUM_TEAMS].sort(() => rand() - 0.5);
    data.general = {
      first: shuffled[0],
      second: shuffled[1],
      third: shuffled[2],
      bestPlayer: "",
      bestGk: "",
      topScorer: "",
    };
    data.generalConfirmed = rand() > 0.4;
  }

  for (const grp of GROUPS) {
    if (rand() > 0.25) continue;
    const teams = [...grp.teams];
    for (let j = teams.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [teams[j], teams[k]] = [teams[k], teams[j]];
    }
    data.groupOrder[grp.id] = teams;
    data.groupOrderConfirmed[grp.id] = rand() > 0.35;
    data.groupThirdAdvances[grp.id] = rand() > 0.5;
  }

  const matchSample = GROUP_MATCHES.filter(() => rand() > 0.55).slice(0, 12);
  for (const m of matchSample) {
    const h = Math.floor(rand() * 4);
    const a = Math.floor(rand() * 4);
    data.groupScores[m.id] = { home: h, away: a };
    if (rand() > 0.3) data.groupScoresConfirmed[m.id] = true;
  }

  return data;
}

initDb();

/** @type {{ username: string, password: string, displayName: string, created: boolean }[]} */
const credentials = [];
let created = 0;
let skipped = 0;

for (let i = 1; i <= COUNT; i++) {
  const username = usernameForIndex(i);
  const password = passwordForIndex(i);
  const displayName = displayNameForIndex(i);

  if (findUserByUsername(username)) {
    skipped += 1;
    credentials.push({ username, password, displayName, created: false });
    continue;
  }

  const passwordHash = await hashPassword(password);
  const user = createUser({ username, passwordHash, displayName, isAdmin: false });
  setUserPredictions(user.id, buildSeedPredictions(i));
  created += 1;
  credentials.push({ username, password, displayName, created: true });
}

const outDir = path.join(__dirname, "..", "server", "data");
fs.mkdirSync(outDir, { recursive: true });
const csvPath = path.join(outDir, "test-users-credentials.csv");
const csvLines = [
  "username,password,display_name,created",
  ...credentials.map((c) =>
    `${c.username},${c.password},"${c.displayName.replace(/"/g, '""')}",${c.created ? "yes" : "skip"}`,
  ),
];
fs.writeFileSync(csvPath, csvLines.join("\n"), "utf8");

console.log(`[arena] Seed usuarios: ${created} creados, ${skipped} ya existían (objetivo ${COUNT}).`);
console.log(`[arena] Credenciales: ${csvPath}`);
console.log(`[arena] Ejemplo: usuario «${credentials[0]?.username}», contraseña «${credentials[0]?.password}».`);
