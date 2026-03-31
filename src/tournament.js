/**
 * Mundial 2026: 12 grupos de 4.
 * Equipos con nombres simples y placeholders únicos (“Por determinar (X)”).
 */

const GROUP_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const TBD_PREFIX = "Por determinar";

export function isPlaceholderTeam(teamName) {
  return String(teamName).startsWith(TBD_PREFIX);
}

/** ISO 3166-1 alpha-2 (o variantes gb-eng / gb-sct en flagcdn) para imágenes reales — evita emojis en Windows. */
export const TEAM_ISO = {
  Mexico: "mx",
  Sudafrica: "za",
  "Corea del Sur": "kr",
  Canada: "ca",
  Catar: "qa",
  Suiza: "ch",
  Brasil: "br",
  Marruecos: "ma",
  Haiti: "ht",
  Escocia: "gb-sct",
  "Estados Unidos": "us",
  Paraguay: "py",
  Australia: "au",
  Alemania: "de",
  Curazao: "cw",
  "Costa de Marfil": "ci",
  Ecuador: "ec",
  "Paises Bajos": "nl",
  Japon: "jp",
  Tunez: "tn",
  Belgica: "be",
  Egipto: "eg",
  Iran: "ir",
  "Nueva Zelanda": "nz",
  Espana: "es",
  "Cabo Verde": "cv",
  "Arabia Saudita": "sa",
  Uruguay: "uy",
  Francia: "fr",
  Senegal: "sn",
  Noruega: "no",
  Argentina: "ar",
  Argelia: "dz",
  Austria: "at",
  Jordania: "jo",
  Portugal: "pt",
  Uzbekistan: "uz",
  Colombia: "co",
  Inglaterra: "gb-eng",
  Croacia: "hr",
  Ghana: "gh",
  Panama: "pa",
};

const FLAGCDN_W = 40;

/**
 * HTML seguro: el código ISO solo sale de TEAM_ISO (alfanumérico y guiones).
 * @returns {string}
 */
export function getTeamFlagImgHtml(teamName) {
  const raw = TEAM_ISO[teamName];
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
      ? ["Mexico", "Sudafrica", "Corea del Sur", tbd(id)]
      : id === "B"
        ? ["Canada", tbd(id), "Catar", "Suiza"]
        : id === "C"
          ? ["Brasil", "Marruecos", "Haiti", "Escocia"]
          : id === "D"
            ? ["Estados Unidos", "Paraguay", "Australia", tbd(id)]
            : id === "E"
              ? ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"]
              : id === "F"
                ? ["Paises Bajos", "Japon", tbd(id), "Tunez"]
                : id === "G"
                  ? ["Belgica", "Egipto", "Iran", "Nueva Zelanda"]
                  : id === "H"
                    ? ["Espana", "Cabo Verde", "Arabia Saudita", "Uruguay"]
                    : id === "I"
                      ? ["Francia", "Senegal", tbd(id), "Noruega"]
                      : id === "J"
                        ? ["Argentina", "Argelia", "Austria", "Jordania"]
                        : id === "K"
                          ? ["Portugal", tbd(id), "Uzbekistan", "Colombia"]
                          : ["Inglaterra", "Croacia", "Ghana", "Panama"],
}));

/**
 * Partidos de fase de grupos con hora de bloqueo opcional (ISO 8601).
 * null = no bloquea (útil mientras no hay calendario).
 */
export const GROUP_MATCHES = GROUPS.flatMap((g) =>
  PAIRS.map(([i, j], idx) => {
    const home = g.teams[i];
    const away = g.teams[j];
    return {
      id: `gg-${g.id}-${idx}`,
      groupId: g.id,
      home,
      away,
      kickoff: null,
    };
  }),
);

/**
 * Plantilla tipo Copa del Mundo: dieciseisavos (16 partidos / 32 equipos) → final.
 * Los textos de cada banda son placeholders hasta que la llave oficial exista; se puede ajustar en `R32_SLOTS`.
 * `matchScoringKey` alinea con `MATCH_SCORING` en scoring-rules (quiniela futura).
 */
const R32_SLOTS = [
  ["2º Grupo A", "2º Grupo B"],
  ["1º Grupo E", "3º ranking"],
  ["1º Grupo F", "2º Grupo C"],
  ["1º Grupo C", "2º Grupo F"],
  ["1º Grupo I", "3º ranking"],
  ["2º Grupo E", "2º Grupo I"],
  ["1º Grupo A", "3º ranking"],
  ["2º Grupo D", "2º Grupo G"],
  ["2º Grupo H", "2º Grupo J"],
  ["1º Grupo L", "3º ranking"],
  ["1º Grupo K", "3º ranking"],
  ["1º Grupo D", "2º Grupo E"],
  ["1º Grupo G", "3º ranking"],
  ["2º Grupo K", "2º Grupo L"],
  ["2º Grupo C", "2º Grupo I"],
  ["1º Grupo J", "2º Grupo H"],
];

export const KNOCKOUT_ROUNDS = [
  {
    id: "r32",
    title: "Dieciseisavos de final",
    matches: R32_SLOTS.map((pair, i) => ({
      id: `ko-r32-${i + 1}`,
      homeLabel: pair[0],
      awayLabel: pair[1],
      kickoff: null,
      matchScoringKey: "r32",
    })),
  },
  {
    id: "r16",
    title: "Octavos de final",
    matches: Array.from({ length: 8 }, (_, i) => ({
      id: `ko-r16-${i + 1}`,
      homeLabel: `Gana 32 · ${i * 2 + 1}`,
      awayLabel: `Gana 32 · ${i * 2 + 2}`,
      kickoff: null,
      matchScoringKey: "r16",
    })),
  },
  {
    id: "qf",
    title: "Cuartos de final",
    matches: [
      { id: "ko-qf-1", homeLabel: "Gana 16 · 1", awayLabel: "Gana 16 · 2", kickoff: null, matchScoringKey: "qf" },
      { id: "ko-qf-2", homeLabel: "Gana 16 · 3", awayLabel: "Gana 16 · 4", kickoff: null, matchScoringKey: "qf" },
      { id: "ko-qf-3", homeLabel: "Gana 16 · 5", awayLabel: "Gana 16 · 6", kickoff: null, matchScoringKey: "qf" },
      { id: "ko-qf-4", homeLabel: "Gana 16 · 7", awayLabel: "Gana 16 · 8", kickoff: null, matchScoringKey: "qf" },
    ],
  },
  {
    id: "sf",
    title: "Semifinales",
    matches: [
      { id: "ko-sf-1", homeLabel: "Gana CF · 1", awayLabel: "Gana CF · 2", kickoff: null, matchScoringKey: "sf" },
      { id: "ko-sf-2", homeLabel: "Gana CF · 3", awayLabel: "Gana CF · 4", kickoff: null, matchScoringKey: "sf" },
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
        kickoff: null,
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
        kickoff: null,
        matchScoringKey: "finalPlacement",
      },
    ],
  },
];

/** Índice de ronda por id (p. ej. «sf», «r32»). */
export function getKnockoutRoundIndex(roundId) {
  return KNOCKOUT_ROUNDS.findIndex((r) => r.id === roundId);
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

/** Índices de partido por columna en cada mitad (izquierda: 0…, derecha: otra mitad del cuadro). */
export const BRACKET_SIDE_MATCH_INDICES = {
  left: {
    r32: [0, 1, 2, 3, 4, 5, 6, 7],
    r16: [0, 1, 2, 3],
    qf: [0, 1],
    sf: [0],
  },
  right: {
    r32: [15, 14, 13, 12, 11, 10, 9, 8],
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
  const feederMatchIdx = side === "home" ? matchIndex * 2 : matchIndex * 2 + 1;
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
 */
export function resolveKnockoutSlotLabel(roundIndex, matchIndex, side, scoresById) {
  const round = KNOCKOUT_ROUNDS[roundIndex];
  if (!round) return "";

  if (round.id === "final" && matchIndex === 0) {
    return resolveFinalOrThirdSlot("final", side, scoresById);
  }
  if (round.id === "tp" && matchIndex === 0) {
    return resolveFinalOrThirdSlot("tp", side, scoresById);
  }

  if (roundIndex === 0) {
    const m = round.matches[matchIndex];
    return side === "home" ? m.homeLabel : m.awayLabel;
  }

  const feeder = getKnockoutFeeder(roundIndex, matchIndex, side);
  if (!feeder) return "";
  const fm = KNOCKOUT_ROUNDS[feeder.roundIndex].matches[feeder.matchIndex];
  const ws = winnerSideFromKnockoutScore(scoresById[feeder.matchId] ?? {});
  if (!ws) {
    const m = round.matches[matchIndex];
    return side === "home" ? m.homeLabel : m.awayLabel;
  }
  return resolveKnockoutSlotLabel(feeder.roundIndex, feeder.matchIndex, ws, scoresById);
}

/**
 * @param {"final"|"tp"} kind
 * @param {"home"|"away"} side — home = cruce asociado a SF·1, away = SF·2
 */
function resolveFinalOrThirdSlot(kind, side, scoresById) {
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
  return resolveKnockoutSlotLabel(sfRi, semiIdx, lineSide, scoresById);
}

/**
 * @param {string} matchId
 * @param {{ home?: string|number|"", away?: string|number|"" }} [sc]
 * @returns {"home"|"away"|null}
 */
export function winnerSideFromKnockoutScore(sc) {
  if (!sc || sc.home === "" || sc.away === "") return null;
  const h = typeof sc.home === "number" ? sc.home : parseInt(String(sc.home), 10);
  const a = typeof sc.away === "number" ? sc.away : parseInt(String(sc.away), 10);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h === a) return null;
  return h > a ? "home" : "away";
}
