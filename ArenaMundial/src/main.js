import "./styles/app.css";
import { requireAuthOrRedirect, LOGIN_URL } from "./auth-client.js";
import {
  getMyPredictions,
  saveMyPredictions,
  logout,
  startSharedPolling,
} from "./api.js";
import { emptyPredictions } from "@shared/predictions-store.js";

const $ = (sel) => document.querySelector(sel);

async function initApp() {
  const user = await requireAuthOrRedirect();
  if (!user) return;

  const nameEl = $("#user-display-name");
  const statusEl = $("#sync-status");
  const rankingsEl = $("#rankings-list");
  const officialEl = $("#official-status");
  const saveBtn = $("#btn-save-test");
  const logoutBtn = $("#btn-logout");

  if (nameEl) nameEl.textContent = user.displayName;

  let predictions = emptyPredictions();

  try {
    const res = await getMyPredictions();
    predictions = res.predictions ?? emptyPredictions();
    if (statusEl) statusEl.textContent = `Predicciones cargadas (${res.updatedAt ?? "nuevo"})`;
  } catch {
    if (statusEl) statusEl.textContent = "Error al cargar predicciones";
  }

  saveBtn?.addEventListener("click", async () => {
    if (statusEl) statusEl.textContent = "Guardando…";
    try {
      const res = await saveMyPredictions(predictions);
      predictions = res.predictions;
      if (statusEl) statusEl.textContent = `Guardado (${res.updatedAt}) — solo tú ves este cambio al instante`;
    } catch {
      if (statusEl) statusEl.textContent = "Error al guardar";
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    await logout().catch(() => {});
    location.href = LOGIN_URL;
  });

  startSharedPolling({
    intervalMs: 45_000,
    onOfficial({ official, updatedAt }) {
      if (!officialEl) return;
      const confirmed = official?.generalOfficialConfirmed ? "publicados" : "pendientes";
      officialEl.textContent = `Resultados oficiales: ${confirmed} · actualizado ${updatedAt ?? "—"}`;
    },
    onRankings({ rankings, totalUsers }) {
      if (!rankingsEl) return;
      if (!rankings?.length) {
        rankingsEl.innerHTML = `<li class="muted">Sin participantes aún</li>`;
        return;
      }
      rankingsEl.innerHTML = rankings
        .slice(0, 10)
        .map(
          (r) =>
            `<li><span class="rank-num">#${r.rank}</span> ${escapeHtml(r.displayName)} <span class="muted">@${escapeHtml(r.username)}</span></li>`,
        )
        .join("");
      const meta = $("#rankings-meta");
      if (meta) meta.textContent = `${totalUsers} participantes registrados`;
    },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

void initApp();
