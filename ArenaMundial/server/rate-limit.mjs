/**
 * Control de tráfico en login/registro: límite por IP, global y concurrencia de bcrypt.
 */

const WINDOW_MS = Number(process.env.ARENA_AUTH_WINDOW_MS || 60_000);
const MAX_PER_IP = Number(process.env.ARENA_AUTH_MAX_PER_IP || 25);
const MAX_GLOBAL = Number(process.env.ARENA_AUTH_MAX_GLOBAL || 300);
const MAX_CONCURRENT = Number(process.env.ARENA_AUTH_MAX_CONCURRENT || 20);

/** @type {Map<string, { count: number; resetAt: number }>} */
const ipBuckets = new Map();
let globalBucket = { count: 0, resetAt: Date.now() + WINDOW_MS };
let concurrentAuth = 0;

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function pruneIpBuckets() {
  if (ipBuckets.size < 5000) return;
  const now = Date.now();
  for (const [ip, b] of ipBuckets) {
    if (now > b.resetAt) ipBuckets.delete(ip);
  }
}

function takeToken(ip) {
  const now = Date.now();
  if (now > globalBucket.resetAt) {
    globalBucket = { count: 0, resetAt: now + WINDOW_MS };
  }
  if (globalBucket.count >= MAX_GLOBAL) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((globalBucket.resetAt - now) / 1000)) };
  }

  let bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    ipBuckets.set(ip, bucket);
  }
  if (bucket.count >= MAX_PER_IP) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  globalBucket.count += 1;
  pruneIpBuckets();
  return { ok: true, retryAfterSec: 0 };
}

export function authTrafficGuard(req, res, next) {
  const ip = clientIp(req);
  const token = takeToken(ip);
  if (!token.ok) {
    res.setHeader("Retry-After", String(token.retryAfterSec));
    res.status(429).json({
      error: `Demasiadas peticiones. Espera ${token.retryAfterSec}s e inténtalo de nuevo.`,
      retryAfterSec: token.retryAfterSec,
    });
    return;
  }

  if (concurrentAuth >= MAX_CONCURRENT) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({
      error: "Mucha gente entrando a la vez. Reintenta en unos segundos.",
      retryAfterSec: 2,
    });
    return;
  }

  concurrentAuth += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    concurrentAuth = Math.max(0, concurrentAuth - 1);
  };
  res.on("finish", release);
  res.on("close", release);
  next();
}
