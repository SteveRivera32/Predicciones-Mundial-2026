const API = "/api/arena";

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    if (data.retryAfterSec) err.retryAfterSec = data.retryAfterSec;
    else if (res.headers.get("Retry-After")) {
      err.retryAfterSec = Number(res.headers.get("Retry-After")) || undefined;
    }
    throw err;
  }
  return data;
}

export function apiFetch(path, options = {}) {
  return fetch(`${API}${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  }).then(parseJson);
}

export function getMe() {
  return apiFetch("/auth/me");
}

export function login(username, password) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function register(payload) {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiFetch("/auth/logout", { method: "POST" });
}

export function getMyPredictions() {
  return apiFetch("/me/predictions");
}

export function saveMyPredictions(predictions) {
  return apiFetch("/me/predictions", {
    method: "PUT",
    body: JSON.stringify(predictions),
  });
}

export function deleteMyAccount() {
  return apiFetch("/me", { method: "DELETE" });
}

export function searchAdminUsers(q) {
  return apiFetch(`/admin/users/search?q=${encodeURIComponent(String(q ?? ""))}`);
}

export function deleteAdminUser(username) {
  return apiFetch(`/admin/users/${encodeURIComponent(String(username ?? ""))}`, {
    method: "DELETE",
  });
}

export function saveOfficialResults(official) {
  return apiFetch("/admin/official", {
    method: "PUT",
    body: JSON.stringify(official),
  });
}

export function getOfficial() {
  return apiFetch("/official");
}

export function getRankings() {
  return apiFetch("/rankings");
}

export function getChatMessages(sinceId = 0) {
  const q = sinceId > 0 ? `?sinceId=${encodeURIComponent(String(sinceId))}` : "";
  return apiFetch(`/chat/messages${q}`);
}

export function sendChatMessage(body) {
  return apiFetch("/chat/messages", {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function getChatLimits() {
  return apiFetch("/chat/limits");
}

/** Poll datos compartidos; no recibe cambios de otros usuarios. */
export function startSharedPolling({ onOfficial, onRankings, intervalMs = 45_000 }) {
  let stopped = false;
  let timer = null;

  async function tick() {
    if (stopped || document.hidden) return;
    try {
      const [officialRes, rankingsRes] = await Promise.all([getOfficial(), getRankings()]);
      onOfficial?.(officialRes);
      onRankings?.(rankingsRes);
    } catch {
      /* red caída: reintentar en el próximo ciclo */
    }
  }

  void tick();
  timer = window.setInterval(tick, intervalMs);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void tick();
  });

  return () => {
    stopped = true;
    if (timer) window.clearInterval(timer);
  };
}
