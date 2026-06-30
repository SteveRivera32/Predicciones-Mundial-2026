/**
 * Mundial 2026: 12 grupos de 4.
 * Equipos con nombres simples y placeholders únicos (“Por determinar (X)”).
 */

import { GROUP_PAIR_KICKOFF_ISO, KO_OTHER_IDS_TO_KICKOFF, R32_ID_TO_KICKOFF } from "./fifa-2026-kickoffs.js";

const GROUP_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const TBD_PREFIX = "Por determinar";

export function isPlaceholderTeam(teamName) {
  return String(teamName).startsWith(TBD_PREFIX);
}

/** Nombres históricos sin tilde → nombre canónico con acentos. */
export const LEGACY_TEAM_NAMES = {
  Mexico: "México",
  Sudafrica: "Sudáfrica",
  Canada: "Canadá",
  Turquia: "Turquía",
  Haiti: "Haití",
  "Paises Bajos": "Países Bajos",
  Japon: "Japón",
  Tunez: "Túnez",
  Belgica: "Bélgica",
  Iran: "Irán",
  Espana: "España",
  Uzbekistan: "Uzbekistán",
  Panama: "Panamá",
};

/** @param {unknown} name */
export function normalizeTeamName(name) {
  if (name == null || name === "") return name;
  const s = String(name);
  return LEGACY_TEAM_NAMES[s] ?? s;
}

/** ISO 3166-1 alpha-2 (o variantes gb-eng / gb-sct en flagcdn) para imágenes reales — evita emojis en Windows. */
export const TEAM_ISO = {
  México: "mx",
  Sudáfrica: "za",
  "Corea del Sur": "kr",
  Canadá: "ca",
  Chequia: "cz",
  Catar: "qa",
  Suiza: "ch",
  "Bosnia y Herzegovina": "ba",
  Brasil: "br",
  Marruecos: "ma",
  Haití: "ht",
  Escocia: "gb-sct",
  "Estados Unidos": "us",
  Paraguay: "py",
  Australia: "au",
  Turquía: "tr",
  Alemania: "de",
  Curazao: "cw",
  "Costa de Marfil": "ci",
  Ecuador: "ec",
  "Países Bajos": "nl",
  Japón: "jp",
  Suecia: "se",
  Túnez: "tn",
  Bélgica: "be",
  Egipto: "eg",
  Irán: "ir",
  "Nueva Zelanda": "nz",
  España: "es",
  "Cabo Verde": "cv",
  "Arabia Saudita": "sa",
  Uruguay: "uy",
  Francia: "fr",
  Senegal: "sn",
  Irak: "iq",
  Noruega: "no",
  Argentina: "ar",
  Argelia: "dz",
  Austria: "at",
  Jordania: "jo",
  Portugal: "pt",
  "RD Congo": "cd",
  Uzbekistán: "uz",
  Colombia: "co",
  Inglaterra: "gb-eng",
  Croacia: "hr",
  Ghana: "gh",
  Panamá: "pa",
};

/**
 * Convierte nombres de equipo guardados (p. ej. sin tilde) al formato canónico.
 * @param {Record<string, unknown>} data
 */
export function migrateStoredTeamNames(data) {
  if (!data || typeof data !== "object") return data;
  /** @type {Record<string, unknown>} */
  const out = { ...data };

  const migratePodium = (/** @type {Record<string, unknown> | undefined} */ obj) => {
    if (!obj || typeof obj !== "object") return obj;
    const next = { ...obj };
    for (const k of ["first", "second", "third"]) {
      if (typeof next[k] === "string") next[k] = normalizeTeamName(next[k]);
    }
    return next;
  };

  if (out.general) out.general = migratePodium(/** @type {Record<string, unknown>} */ (out.general));
  if (out.generalOfficial) {
    out.generalOfficial = migratePodium(/** @type {Record<string, unknown>} */ (out.generalOfficial));
  }

  const migrateOrderMap = (/** @type {Record<string, unknown> | undefined} */ map) => {
    if (!map || typeof map !== "object") return map;
    const next = { ...map };
    for (const [gid, ord] of Object.entries(next)) {
      if (Array.isArray(ord)) {
        next[gid] = ord.map((t) => (typeof t === "string" ? normalizeTeamName(t) : t));
      }
    }
    return next;
  };

  if (out.groupOrder) out.groupOrder = migrateOrderMap(/** @type {Record<string, unknown>} */ (out.groupOrder));
  if (out.groupOfficialOrder) {
    out.groupOfficialOrder = migrateOrderMap(/** @type {Record<string, unknown>} */ (out.groupOfficialOrder));
  }

  return out;
}

const FLAGCDN_W = 40;

/**
 * HTML seguro: el código ISO solo sale de TEAM_ISO (alfanumérico y guiones).
 * @returns {string}
 */
export function getTeamFlagImgHtml(teamName) {
  const raw = TEAM_ISO[teamName] ?? TEAM_ISO[normalizeTeamName(teamName)];
  if (raw && /^[a-z0-9-]+$/i.test(raw)) {
    const code = raw.toLowerCase();
    const src = `https://flagcdn.com/w${FLAGCDN_W}/${code}.png`;
    return `<img class="team-flag-img" src="${src}" alt="" width="28" height="21" loading="lazy" decoding="async" />`;
  }
  return `<span class="team-flag-placeholder" title="Por determinar" aria-hidden="true"></span>`;
}

function tbd(groupId) {
  return `${TBD_PREFIX} (${groupId})`;
}

/** Parejas de partidos dentro del grupo (índices en teams) */
const PAIRS = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];

export const GROUPS = GROUP_IDS.map((id) => ({
  id,
  teams:
    id === "A"
      ? ["México", "Sudáfrica", "Corea del Sur", "Chequia"]
      : id === "B"
        ? ["Canadá", "Bosnia y Herzegovina", "Catar", "Suiza"]
        : id === "C"
          ? ["Brasil", "Marruecos", "Haití", "Escocia"]
          : id === "D"
            ? ["Estados Unidos", "Paraguay", "Australia", "Turquía"]
            : id === "E"
              ? ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"]
              : id === "F"
                ? ["Países Bajos", "Japón", "Suecia", "Túnez"]
                : id === "G"
                  ? ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"]
                  : id === "H"
                    ? ["España", "Cabo Verde", "Arabia Saudita", "Uruguay"]
                    : id === "I"
                      ? ["Francia", "Senegal", "Irak", "Noruega"]
                      : id === "J"
                        ? ["Argentina", "Argelia", "Austria", "Jordania"]
                        : id === "K"
                          ? ["Portugal", "RD Congo", "Uzbekistán", "Colombia"]
                          : ["Inglaterra", "Croacia", "Ghana", "Panamá"],
}));

/**
 * Partidos de fase de grupos con hora de bloqueo opcional (ISO 8601).
 * null = no bloquea (útil mientras no hay calendario).
 */
export const GROUP_MATCHES = GROUPS.flatMap((g) =>
  PAIRS.map(([i, j], idx) => {
    const home = g.teams[i];
    const away = g.teams[j];
    const sched = GROUP_PAIR_KICKOFF_ISO[g.id];
    const kickoff = sched?.[idx] ?? null;
    return {
      id: `gg-${g.id}-${idx}`,
      groupId: g.id,
      home,
      away,
      kickoff,
    };
  }),
);

/**
 * Llave oficial Ronda de 32 (M73–M88), según FIFA / bracketmundial2026.com.
 * Los cruces con 3.º usan pools de grupos elegibles; la asignación concreta sigue el Anexo C.
 * `matchScoringKey` alinea con `MATCH_SCORING` en scoring-rules (quiniela futura).
 */
export const R32_THIRD_POOL_LABELS = {
  E: "3º A/B/C/D/F",
  I: "3º C/D/F/G/H",
  A: "3º C/E/F/H/I",
  L: "3º E/H/I/J/K",
  D: "3º B/E/F/I/J",
  G: "3º A/E/H/I/J",
  B: "3º E/F/G/I/J",
  K: "3º D/E/I/J/L",
};

/** Partido de 16vos → letra del 1.º al que se enfrenta el 3.º (Anexo C). */
export const R32_THIRD_WINNER_FOR_MATCH_ID = {
  "ko-r32-2": "E",
  "ko-r32-5": "I",
  "ko-r32-7": "A",
  "ko-r32-8": "L",
  "ko-r32-9": "D",
  "ko-r32-10": "G",
  "ko-r32-13": "B",
  "ko-r32-15": "K",
};

const R32_SLOTS = [
  ["2º Grupo A", "2º Grupo B"], // M73
  ["1º Grupo E", R32_THIRD_POOL_LABELS.E], // M74
  ["1º Grupo F", "2º Grupo C"], // M75
  ["1º Grupo C", "2º Grupo F"], // M76
  ["1º Grupo I", R32_THIRD_POOL_LABELS.I], // M77
  ["2º Grupo E", "2º Grupo I"], // M78
  ["1º Grupo A", R32_THIRD_POOL_LABELS.A], // M79
  ["1º Grupo L", R32_THIRD_POOL_LABELS.L], // M80
  ["1º Grupo D", R32_THIRD_POOL_LABELS.D], // M81
  ["1º Grupo G", R32_THIRD_POOL_LABELS.G], // M82
  ["2º Grupo K", "2º Grupo L"], // M83
  ["1º Grupo H", "2º Grupo J"], // M84
  ["1º Grupo B", R32_THIRD_POOL_LABELS.B], // M85
  ["1º Grupo J", "2º Grupo H"], // M86
  ["1º Grupo K", R32_THIRD_POOL_LABELS.K], // M87
  ["2º Grupo D", "2º Grupo G"], // M88
];

/**
 * Alimentadores personalizados R32 → octavos (M89–M96), índices 0-based en r32.matches.
 * @type {Record<string, Array<{ home: number, away: number }>>}
 */
const KO_CUSTOM_FEEDERS = {
  r16: [
    { home: 0, away: 2 }, // M90: W73 vs W75
    { home: 1, away: 4 }, // M89: W74 vs W77
    { home: 3, away: 5 }, // M91: W76 vs W78
    { home: 6, away: 7 }, // M92: W79 vs W80
    { home: 10, away: 11 }, // M93: W83 vs W84
    { home: 8, away: 9 }, // M94: W81 vs W82
    { home: 13, away: 15 }, // M95: W86 vs W88
    { home: 12, away: 14 }, // M96: W85 vs W87
  ],
};

function koKick(id) {
  return R32_ID_TO_KICKOFF[id] ?? KO_OTHER_IDS_TO_KICKOFF[id] ?? null;
}

export const KNOCKOUT_ROUNDS = [
  {
    id: "r32",
    title: "Dieciséisavos de final",
    matches: R32_SLOTS.map((pair, i) => {
      const id = `ko-r32-${i + 1}`;
      return {
        id,
        homeLabel: pair[0],
        awayLabel: pair[1],
        kickoff: koKick(id),
        matchScoringKey: "r32",
      };
    }),
  },
  {
    id: "r16",
    title: "Octavos de final",
    matches: [
      { id: "ko-r16-1", homeLabel: "Gana 32 · 1", awayLabel: "Gana 32 · 3", kickoff: koKick("ko-r16-1"), matchScoringKey: "r16" }, // M90
      { id: "ko-r16-2", homeLabel: "Gana 32 · 2", awayLabel: "Gana 32 · 5", kickoff: koKick("ko-r16-2"), matchScoringKey: "r16" }, // M89
      { id: "ko-r16-3", homeLabel: "Gana 32 · 4", awayLabel: "Gana 32 · 6", kickoff: koKick("ko-r16-3"), matchScoringKey: "r16" }, // M91
      { id: "ko-r16-4", homeLabel: "Gana 32 · 7", awayLabel: "Gana 32 · 8", kickoff: koKick("ko-r16-4"), matchScoringKey: "r16" }, // M92
      { id: "ko-r16-5", homeLabel: "Gana 32 · 11", awayLabel: "Gana 32 · 12", kickoff: koKick("ko-r16-5"), matchScoringKey: "r16" }, // M93
      { id: "ko-r16-6", homeLabel: "Gana 32 · 9", awayLabel: "Gana 32 · 10", kickoff: koKick("ko-r16-6"), matchScoringKey: "r16" }, // M94
      { id: "ko-r16-7", homeLabel: "Gana 32 · 14", awayLabel: "Gana 32 · 16", kickoff: koKick("ko-r16-7"), matchScoringKey: "r16" }, // M95
      { id: "ko-r16-8", homeLabel: "Gana 32 · 13", awayLabel: "Gana 32 · 15", kickoff: koKick("ko-r16-8"), matchScoringKey: "r16" }, // M96
    ],
  },
  {
    id: "qf",
    title: "Cuartos de final",
    matches: [
      { id: "ko-qf-1", homeLabel: "Gana 16 · 1", awayLabel: "Gana 16 · 2", kickoff: koKick("ko-qf-1"), matchScoringKey: "qf" },
      { id: "ko-qf-2", homeLabel: "Gana 16 · 3", awayLabel: "Gana 16 · 4", kickoff: koKick("ko-qf-2"), matchScoringKey: "qf" },
      { id: "ko-qf-3", homeLabel: "Gana 16 · 5", awayLabel: "Gana 16 · 6", kickoff: koKick("ko-qf-3"), matchScoringKey: "qf" },
      { id: "ko-qf-4", homeLabel: "Gana 16 · 7", awayLabel: "Gana 16 · 8", kickoff: koKick("ko-qf-4"), matchScoringKey: "qf" },
    ],
  },
  {
    id: "sf",
    title: "Semifinales",
    matches: [
      { id: "ko-sf-1", homeLabel: "Gana CF · 1", awayLabel: "Gana CF · 2", kickoff: koKick("ko-sf-1"), matchScoringKey: "sf" },
      { id: "ko-sf-2", homeLabel: "Gana CF · 3", awayLabel: "Gana CF · 4", kickoff: koKick("ko-sf-2"), matchScoringKey: "sf" },
    ],
  },
  {
    id: "tp",
    title: "3.er y 4.º puesto",
    matches: [
      {
        id: "ko-tp-1",
        homeLabel: "Perd. SF · 1",
        awayLabel: "Perd. SF · 2",
        kickoff: koKick("ko-tp-1"),
        matchScoringKey: "finalPlacement",
      },
    ],
  },
  {
    id: "final",
    title: "Final",
    matches: [
      {
        id: "ko-fin-1",
        homeLabel: "Gana SF · 1",
        awayLabel: "Gana SF · 2",
        kickoff: koKick("ko-fin-1"),
        matchScoringKey: "finalPlacement",
      },
    ],
  },
];

/** Índice de ronda por id (p. ej. «sf», «r32»). */
export function getKnockoutRoundIndex(roundId) {
  return KNOCKOUT_ROUNDS.findIndex((r) => r.id === roundId);
}

/** Desde 16vos de final en adelante: si el marcador predicho/oficial es empate, hay que elegir ganador en penales. */
const KO_ROUNDS_REQUIRING_PENALTY_ON_DRAW = new Set(["r32", "r16", "qf", "sf", "tp", "final"]);

/**
 * @param {string | undefined} roundId
 * @returns {boolean}
 */
export function knockoutRoundRequiresPenaltyPickOnDraw(roundId) {
  return typeof roundId === "string" && KO_ROUNDS_REQUIRING_PENALTY_ON_DRAW.has(roundId);
}

/**
 * Lista plana de partidos de eliminatoria para la pestaña Partidos (predicciones).
 * @returns {{ id: string, home: string, away: string, roundId: string, kickoff: null, matchScoringKey?: string }[]}
 */
export function getKnockoutMatchesFlat() {
  return KNOCKOUT_ROUNDS.flatMap((round) =>
    round.matches.map((m) => ({
      id: m.id,
      home: m.homeLabel,
      away: m.awayLabel,
      roundId: round.id,
      kickoff: m.kickoff,
      matchScoringKey: m.matchScoringKey,
    })),
  );
}

/** Índices de partidos de 16vos en la mitad izquierda / derecha del cuadro (0-based). */
export const BRACKET_LEFT_R32_IDX = /** @type {const} */ ([0, 1, 2, 3, 4, 5, 6, 7]);
export const BRACKET_RIGHT_R32_IDX = /** @type {const} */ ([8, 9, 10, 11, 12, 13, 14, 15]);

/** Índices de ronda en KNOCKOUT_ROUNDS para cada fase de visualización. */
export const KNOCKOUT_PHASE_ROUND_INDEX = {
  r32: 0,
  r16: 1,
  qf: 2,
  sf: 3,
  tp: 4,
  final: 5,
};

/** Índices de partido por columna en cada mitad (orden del árbol del cuadro, no M73…M88 lineal). */
export const BRACKET_SIDE_MATCH_INDICES = {
  left: {
    r32: [0, 2, 1, 4, 3, 5, 6, 7],
    r16: [0, 1, 2, 3],
    qf: [0, 1],
    sf: [0],
  },
  right: {
    r32: [14, 12, 15, 13, 9, 8, 11, 10],
    r16: [7, 6, 5, 4],
    qf: [3, 2],
    sf: [1],
  },
};

/** Índices de ronda y partido en KNOCKOUT_ROUNDS (0 = dieciseisavos). */
export function getKnockoutFeeder(roundIndex, matchIndex, side) {
  const round = KNOCKOUT_ROUNDS[roundIndex];
  if (!round || round.id === "final" || round.id === "tp") return null;
  if (roundIndex <= 0) return null;
  const prevIdx = roundIndex - 1;
  const prevRound = KNOCKOUT_ROUNDS[prevIdx];
  if (prevRound.id === "tp") return null;
  const custom = KO_CUSTOM_FEEDERS[round.id]?.[matchIndex];
  const feederMatchIdx = custom
    ? custom[side]
    : side === "home"
      ? matchIndex * 2
      : matchIndex * 2 + 1;
  const m = prevRound.matches[feederMatchIdx];
  if (!m) return null;
  return { roundIndex: prevIdx, matchIndex: feederMatchIdx, matchId: m.id };
}

/**
 * Resuelve el texto de una banda (local/visit) según marcadores de la eliminatoria.
 * @param {number} roundIndex
 * @param {number} matchIndex
 * @param {"home"|"away"} side
 * @param {Record<string, { home?: string|number|"", away?: string|number|"" }>} scoresById
 * @param {Record<string, string>} [r32SlotMap] `matchId:home|away` → equipo resuelto en 16vos
 */
export function resolveKnockoutSlotLabel(roundIndex, matchIndex, side, scoresById, r32SlotMap) {
  const round = KNOCKOUT_ROUNDS[roundIndex];
  if (!round) return "";

  if (round.id === "final" && matchIndex === 0) {
    return resolveFinalOrThirdSlot("final", side, scoresById, r32SlotMap);
  }
  if (round.id === "tp" && matchIndex === 0) {
    return resolveFinalOrThirdSlot("tp", side, scoresById, r32SlotMap);
  }

  if (roundIndex === 0) {
    const m = round.matches[matchIndex];
    const fromMap = r32SlotMap?.[`${m.id}:${side}`];
    if (fromMap) return fromMap;
    return side === "home" ? m.homeLabel : m.awayLabel;
  }

  const feeder = getKnockoutFeeder(roundIndex, matchIndex, side);
  if (!feeder) return "";
  const ws = winnerSideFromKnockoutScore(scoresById[feeder.matchId] ?? {});
  if (!ws) {
    const m = round.matches[matchIndex];
    return side === "home" ? m.homeLabel : m.awayLabel;
  }
  return resolveKnockoutSlotLabel(feeder.roundIndex, feeder.matchIndex, ws, scoresById, r32SlotMap);
}

/**
 * @param {"final"|"tp"} kind
 * @param {"home"|"away"} side — home = cruce asociado a SF·1, away = SF·2
 * @param {Record<string, string>} [r32SlotMap]
 */
function resolveFinalOrThirdSlot(kind, side, scoresById, r32SlotMap) {
  const sfRi = KNOCKOUT_ROUNDS.findIndex((r) => r.id === "sf");
  const sfRound = KNOCKOUT_ROUNDS[sfRi];
  const semiIdx = side === "home" ? 0 : 1;
  const semiM = sfRound.matches[semiIdx];
  const targetRound = KNOCKOUT_ROUNDS.find((r) => r.id === (kind === "final" ? "final" : "tp"));
  const m = targetRound?.matches[0];
  if (!m) return "";

  const w = winnerSideFromKnockoutScore(scoresById[semiM.id] ?? {});
  if (!w) {
    return side === "home" ? m.homeLabel : m.awayLabel;
  }
  const wantWinner = kind === "final";
  const lineSide = wantWinner ? w : w === "home" ? "away" : "home";
  return resolveKnockoutSlotLabel(sfRi, semiIdx, lineSide, scoresById, r32SlotMap);
}

/**
 * @param {string} matchId
 * @param {{ home?: string|number|"", away?: string|number|"", penaltyWinner?: "home"|"away"|"" }} [sc]
 * @returns {"home"|"away"|null}
 */
export function winnerSideFromKnockoutScore(sc) {
  if (!sc || sc.home === "" || sc.away === "") return null;
  const h = typeof sc.home === "number" ? sc.home : parseInt(String(sc.home), 10);
  const a = typeof sc.away === "number" ? sc.away : parseInt(String(sc.away), 10);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h === a) {
    const pw = sc.penaltyWinner;
    if (pw === "home" || pw === "away") return pw;
    return null;
  }
  return h > a ? "home" : "away";
}
