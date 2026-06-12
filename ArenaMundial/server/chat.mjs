/**
 * Chat global Arena: cooldown 5 s entre mensajes; 60 s si repites el mismo texto.
 */

const GLOBAL_COOLDOWN_MS = Number(process.env.ARENA_CHAT_COOLDOWN_MS || 5000);
const DUPLICATE_COOLDOWN_MS = Number(process.env.ARENA_CHAT_DUP_COOLDOWN_MS || 60_000);
export const CHAT_MAX_LEN = Number(process.env.ARENA_CHAT_MAX_LEN || 280);

/** @type {Map<number, { lastAt: number, lastNorm: string }>} */
const userState = new Map();

function normalizeForDup(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function sanitizeChatBody(raw) {
  const s = String(raw ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  if (!s) return "";
  return s.length > CHAT_MAX_LEN ? s.slice(0, CHAT_MAX_LEN) : s;
}

/**
 * @param {number} userId
 * @param {string} text
 */
export function checkChatRateLimit(userId, text) {
  const now = Date.now();
  const norm = normalizeForDup(text);
  const st = userState.get(userId) ?? { lastAt: 0, lastNorm: "" };

  if (st.lastAt > 0 && now - st.lastAt < GLOBAL_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "rate",
      retryAfterSec: Math.max(1, Math.ceil((GLOBAL_COOLDOWN_MS - (now - st.lastAt)) / 1000)),
    };
  }

  if (norm && norm === st.lastNorm && st.lastAt > 0 && now - st.lastAt < DUPLICATE_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "duplicate",
      retryAfterSec: Math.max(1, Math.ceil((DUPLICATE_COOLDOWN_MS - (now - st.lastAt)) / 1000)),
    };
  }

  return { ok: true, retryAfterSec: 0 };
}

/**
 * @param {number} userId
 * @param {string} text
 */
export function recordChatSend(userId, text) {
  userState.set(userId, {
    lastAt: Date.now(),
    lastNorm: normalizeForDup(text),
  });
}
