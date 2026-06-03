/**
 * Descarga y parsea convocatorias desde ESPN (HTML completo con todos los países).
 * Uso: node scripts/parse-espn-squads.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlCachePath = path.join(__dirname, "espn-page.html");
const outPath = path.join(__dirname, "..", "src", "award-nominees.js");

const ESPN_URL =
  "https://espndeportes.espn.com/futbol/mundial/nota/_/id/16715015/mundial-2026-convocatorias-de-selecciones-todas-las-listas-de-jugadores";

const POS_MAP = {
  porteros: "gk",
  portero: "gk",
  defensas: "outfield",
  defensa: "outfield",
  centrocampistas: "outfield",
  centrocampista: "outfield",
  mediocampistas: "outfield",
  mediocampista: "outfield",
  delanteros: "outfield",
  delantero: "outfield",
};

const COUNTRY_ALIASES = {
  Mexico: "México",
  Czechia: "Chequia",
  Morocco: "Marruecos",
  "Bosnia-Herzegovina": "Bosnia y Herzegovina",
  Qatar: "Catar",
};

const SKIP_COUNTRY = /^(ESPN|Grupo\s|Gupo\s|Group\s)/i;

/** @type {Map<string, { name: string, country: string, role: "gk" | "outfield" }>} */
const byKey = new Map();

function normalizeCountry(raw) {
  const s = raw.replace(/^>/, "").replace(/\s+/g, " ").trim();
  return COUNTRY_ALIASES[s] ?? s;
}

function cleanName(raw) {
  return raw
    .replace(/[\u200B-\u200D\uFEFF⁠]/g, "")
    .replace(/[.,;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addPlayer(name, country, role) {
  const n = cleanName(name);
  if (!n || n.length < 2 || !country) return;
  if (/^(porteros?|defensas?|centrocampistas?|mediocampistas?|delanteros?)$/i.test(n)) return;
  const key = `${n.toLowerCase()}|${country.toLowerCase()}`;
  if (!byKey.has(key)) {
    byKey.set(key, { name: n, country, role });
  }
}

/** @param {string} html */
function extractPlayersFromHtmlFragment(html) {
  /** @type {Set<string>} */
  const names = new Set();

  const linkRe = /<a\s+data-player-guid="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const name = cleanName(m[1].replace(/<[^>]+>/g, ""));
    if (name) names.add(name);
  }

  let plain = html.replace(/<a\s+data-player-guid="[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "@@PLAYER@@");
  plain = plain.replace(/<a\s+data-clubhouse-guid="[^"]*"[^>]*>[\s\S]*?<\/a>/gi, "");
  plain = plain.replace(/<[^>]+>/g, " ");
  plain = plain.replace(/\([^)]*\)/g, " ");
  plain = plain.replace(/@@PLAYER@@/g, ",");

  for (const chunk of plain.split(/,|\sy\s+/)) {
    const name = cleanName(chunk);
    if (name && name.length >= 2) names.add(name);
  }

  return [...names];
}

function parseSquadsHtml(html) {
  const start = html.indexOf('id="grupoa"');
  const end = html.lastIndexOf(">Panamá</a>");
  const body = start >= 0 && end > start ? html.slice(start, end + 8000) : html;
  const chunks = body.split(/<h2\b/i).slice(1);

  for (const chunk of chunks) {
    const countryMatch =
      chunk.match(/<a[^>]*>([^<]+)<\/a>\s*<\/h2>/i) ?? chunk.match(/^([^<]{2,40})<\/h2>/i);
    if (!countryMatch) continue;

    const country = normalizeCountry(countryMatch[1]);
    if (SKIP_COUNTRY.test(country) || country.length > 40 || /convocatorias/i.test(country)) continue;

    const section = chunk.slice(countryMatch[0].length);
    const posRe =
      /<strong>(?:<em>)?(Porteros?|Defensas?|Centrocampistas?|Mediocampistas?|Delanteros?)\s*:?\s*(?:<\/em>)?<\/strong>\s*([\s\S]*?)(?=<\/p>)/gi;

    let posMatch;
    while ((posMatch = posRe.exec(section))) {
      const posKey = posMatch[1].toLowerCase();
      const role = POS_MAP[posKey] ?? "outfield";
      for (const name of extractPlayersFromHtmlFragment(posMatch[2])) {
        addPlayer(name, country, role);
      }
    }
  }
}

async function loadHtml() {
  try {
    const res = await fetch(ESPN_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PrediccionesMundial2026/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    fs.writeFileSync(htmlCachePath, text, "utf8");
    return text;
  } catch (e) {
    if (fs.existsSync(htmlCachePath)) {
      console.warn("[parse-espn-squads] fetch falló, usando caché local:", e.message);
      return fs.readFileSync(htmlCachePath, "utf8");
    }
    throw e;
  }
}

const html = await loadHtml();
parseSquadsHtml(html);

const entries = [...byKey.values()].sort((a, b) =>
  a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
);

const uniqueGks = [...new Set(entries.filter((e) => e.role === "gk").map((e) => e.name))].sort((a, b) =>
  a.localeCompare(b, "es", { sensitivity: "base" }),
);
const uniqueOut = [...new Set(entries.filter((e) => e.role === "outfield").map((e) => e.name))].sort((a, b) =>
  a.localeCompare(b, "es", { sensitivity: "base" }),
);

const countries = [...new Set(entries.map((e) => e.country))].sort((a, b) => a.localeCompare(b, "es"));
const perCountry = Object.fromEntries(
  countries.map((c) => [c, entries.filter((e) => e.country === c).length]),
);

const file = `/**
 * Convocados Mundial 2026 (listas publicadas en ESPN, jun 2026).
 * Porteros solo en «Mejor portero»; el resto en «Mejor jugador» y «Goleador».
 * Fuente: ${ESPN_URL}
 * Regenerar: node scripts/parse-espn-squads.mjs
 */

/** @typedef {{ name: string, country: string, role: "gk" | "outfield" }} SquadEntry */

/** @type {SquadEntry[]} */
export const SQUAD_ENTRIES = ${JSON.stringify(entries, null, 2)};

/** Porteros convocados (orden alfabético). */
export const AWARD_GOALKEEPERS = ${JSON.stringify(uniqueGks, null, 2)};

/** Jugadores de campo convocados (orden alfabético). */
export const AWARD_OUTFIELD_PLAYERS = ${JSON.stringify(uniqueOut, null, 2)};

/** @deprecated Compatibilidad: todos los convocados. */
export const AWARD_NOMINEES = [...AWARD_OUTFIELD_PLAYERS, ...AWARD_GOALKEEPERS].sort((a, b) =>
  a.localeCompare(b, "es", { sensitivity: "base" }),
);

/**
 * @param {"gk" | "outfield"} role
 * @returns {string[]}
 */
export function getAwardCandidates(role) {
  return role === "gk" ? AWARD_GOALKEEPERS : AWARD_OUTFIELD_PLAYERS;
}

/**
 * @param {"gk" | "outfield"} role
 * @returns {SquadEntry[]}
 */
export function getSquadEntriesByRole(role) {
  return SQUAD_ENTRIES.filter((e) => e.role === role);
}
`;

fs.writeFileSync(outPath, file, "utf8");
console.log(
  `Wrote ${entries.length} players (${uniqueGks.length} GK, ${uniqueOut.length} outfield) from ${countries.length} selecciones → ${outPath}`,
);
const low = countries.filter((c) => perCountry[c] < 10);
if (low.length) console.warn("Selecciones con pocos jugadores (<10):", low.map((c) => `${c} (${perCountry[c]})`).join(", "));
