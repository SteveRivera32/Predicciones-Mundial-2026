/**
 * Resultado oficial manual en Arena (SQLite).
 * Uso: node ArenaMundial/scripts/set-match-official.mjs gg-A-0 2 0
 */

import { initDb, getOfficialResults, setOfficialResults } from "../server/db.mjs";
import { normalizeOfficialResultsData } from "../../src/official-results-store.js";
import { GROUP_MATCHES, getKnockoutMatchesFlat } from "../../src/tournament.js";

const matchId = process.argv[2];
const home = Number(process.argv[3]);
const away = Number(process.argv[4]);

if (!matchId || !Number.isFinite(home) || !Number.isFinite(away)) {
  console.error("Uso: node ArenaMundial/scripts/set-match-official.mjs <matchId> <golesLocal> <golesVisitante>");
  console.error("Ejemplo México–Sudáfrica: node ArenaMundial/scripts/set-match-official.mjs gg-A-0 2 0");
  process.exit(1);
}

const group = GROUP_MATCHES.find((m) => m.id === matchId);
const ko = getKnockoutMatchesFlat().find((m) => m.id === matchId);
if (!group && !ko) {
  console.error(`Partido desconocido: ${matchId}`);
  process.exit(1);
}

initDb();
const { data } = getOfficialResults();
const official = normalizeOfficialResultsData(data);

if (group) {
  official.groupMatchState[matchId] = "finished";
  official.groupScores[matchId] = { home, away };
  official.groupScoresConfirmed[matchId] = true;
} else {
  official.knockoutMatchState[matchId] = "finished";
  official.knockoutScores[matchId] = {
    home,
    away,
    penaltyWinner: home === away ? "" : "",
  };
  official.knockoutScoresConfirmed[matchId] = true;
}

setOfficialResults(official);
const label = group ? `${group.home} ${home}-${away} ${group.away}` : matchId;
console.log(`[arena] Resultado oficial confirmado: ${label} (${matchId})`);
