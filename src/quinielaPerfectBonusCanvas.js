/**
 * Fondos animados 1.ª celda fila líder (quiniela): gradiente 120° + chroma-js, bucle sin salto.
 * - perfect+bono: arcoíris completo (desfase de matiz 360°).
 * - bien / badge / excelente / perfect: matiz anclado al color del tier + onda senoidal en fase (t=0 ≡ t=1).
 * @see https://github.com/gka/chroma.js
 */
import chroma from "chroma-js";

const PERIOD_MS = 4500;
const COLOR_STOPS = 6;
const BLEED_REM = 0.18;

/** Opacidad solo del canvas multicolor (bonus). Bordes ::before al 100 %. */
const FILL_ALPHA = 0.5;
/** Misma idea para tiers azul / morado / dorado. */
const LEAD_TIER_VIZ = 0.5;

/** Periodos por tier (alineados ~con quiniela-lead-name-bg-flow). */
const TIER_PERIOD_MS = {
  bien: 5200,
  badge: 6000,
  excelente: 5800,
  perfect: 4800,
};

/** @type {Record<string, { hCenter: number; hSpread: number; s: number; l: number; waveDeg: number }>} */
const TIER_SPEC = {
  bien: { hCenter: 212, hSpread: 16, s: 0.7, l: 0.5, waveDeg: 14 },
  badge: { hCenter: 215, hSpread: 15, s: 0.74, l: 0.48, waveDeg: 12 },
  excelente: { hCenter: 285, hSpread: 14, s: 0.52, l: 0.46, waveDeg: 12 },
  perfect: { hCenter: 44, hSpread: 18, s: 0.82, l: 0.48, waveDeg: 14 },
};

/** @type {Set<HTMLCanvasElement>} */
const registered = new Set();
/** @type {WeakMap<HTMLCanvasElement, ResizeObserver>} */
const resizeObservers = new WeakMap();
let rafId = 0;

function bleedPx() {
  const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return BLEED_REM * fs;
}

/**
 * @param {HTMLCanvasElement} canvas
 */
function syncVizCustomProps(canvas) {
  const td = canvas.parentElement;
  if (!(td instanceof HTMLElement) || td.tagName !== "TD") return;
  if (canvas.classList.contains("quiniela-perfect-bonus-gradient-canvas")) {
    td.style.setProperty("--pm26-perfect-bonus-viz", String(FILL_ALPHA));
    td.style.removeProperty("--pm26-lead-tier-viz");
  } else {
    td.style.setProperty("--pm26-lead-tier-viz", String(LEAD_TIER_VIZ));
    td.style.removeProperty("--pm26-perfect-bonus-viz");
  }
}

function syncCanvasLayoutHeight(canvas) {
  const td = canvas.parentElement;
  if (!td || td.tagName !== "TD") return;
  const h = td.getBoundingClientRect().height + 2 * bleedPx();
  canvas.style.height = `${Math.max(1, h)}px`;
}

function attachLayoutObserver(canvas) {
  const td = canvas.parentElement;
  if (!td || td.tagName !== "TD" || resizeObservers.has(canvas)) return;
  const ro = new ResizeObserver(() => syncCanvasLayoutHeight(canvas));
  ro.observe(td);
  resizeObservers.set(canvas, ro);
  syncCanvasLayoutHeight(canvas);
  syncVizCustomProps(canvas);
}

function detachLayoutObserver(canvas) {
  const ro = resizeObservers.get(canvas);
  if (ro) {
    ro.disconnect();
    resizeObservers.delete(canvas);
  }
}

function cssAngle120GradientEndpoints(cw, ch) {
  const cx = cw / 2;
  const cy = ch / 2;
  const rad = (120 * Math.PI) / 180;
  const ux = Math.sin(rad);
  const uy = -Math.cos(rad);
  const L = Math.hypot(cw, ch) / 2;
  return {
    x0: cx - L * ux,
    y0: cy - L * uy,
    x1: cx + L * ux,
    y1: cy + L * uy,
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} phase01
 */
function drawPerfectBonusFrame(canvas, phase01) {
  const td = canvas.parentElement;
  if (!td || td.tagName !== "TD") return;

  const dpr = window.devicePixelRatio || 1;
  const br = canvas.getBoundingClientRect();
  const w = Math.max(1, br.width);
  const h = Math.max(1, br.height);
  if (h < 2 || w < 2) return;

  const cw = Math.max(1, Math.round(w * dpr));
  const ch = Math.max(1, Math.round(h * dpr));

  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { x0, y0, x1, y1 } = cssAngle120GradientEndpoints(cw, ch);
  const grd = ctx.createLinearGradient(x0, y0, x1, y1);

  const hueShift = phase01 * 360;
  for (let i = 0; i <= COLOR_STOPS; i++) {
    const p = i / COLOR_STOPS;
    const hDeg = (p * 360 + hueShift) % 360;
    grd.addColorStop(p, chroma.hsl(hDeg, 0.88, 0.56).css());
  }

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, cw, ch);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} phase01
 * @param {keyof typeof TIER_SPEC} tier
 */
function drawLeadTierFrame(canvas, phase01, tier) {
  const spec = TIER_SPEC[tier];
  if (!spec) return;

  const td = canvas.parentElement;
  if (!td || td.tagName !== "TD") return;

  const dpr = window.devicePixelRatio || 1;
  const br = canvas.getBoundingClientRect();
  const w = Math.max(1, br.width);
  const h = Math.max(1, br.height);
  if (h < 2 || w < 2) return;

  const cw = Math.max(1, Math.round(w * dpr));
  const ch = Math.max(1, Math.round(h * dpr));

  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { x0, y0, x1, y1 } = cssAngle120GradientEndpoints(cw, ch);
  const grd = ctx.createLinearGradient(x0, y0, x1, y1);

  for (let i = 0; i <= COLOR_STOPS; i++) {
    const p = i / COLOR_STOPS;
    const wave = Math.sin(2 * Math.PI * (phase01 + p * 0.4)) * spec.waveDeg;
    const hDeg = (spec.hCenter + (p - 0.5) * 2 * spec.hSpread + wave + 360) % 360;
    grd.addColorStop(p, chroma.hsl(hDeg, spec.s, spec.l).css());
  }

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, cw, ch);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {"bonus" | keyof typeof TIER_SPEC | null}
 */
function canvasKind(canvas) {
  if (canvas.classList.contains("quiniela-perfect-bonus-gradient-canvas")) return "bonus";
  const t = canvas.dataset.pm26LeadTier;
  if (t === "bien" || t === "badge" || t === "excelente" || t === "perfect") return t;
  return null;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} now
 */
function drawRegisteredFrame(canvas, now) {
  const kind = canvasKind(canvas);
  if (kind === "bonus") {
    drawPerfectBonusFrame(canvas, (now / PERIOD_MS) % 1);
    return;
  }
  if (kind) {
    const period = TIER_PERIOD_MS[kind] ?? 5200;
    drawLeadTierFrame(canvas, (now / period) % 1, kind);
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function tick(now) {
  if (prefersReducedMotion()) {
    for (const c of [...registered]) {
      if (!c.isConnected) {
        detachLayoutObserver(c);
        registered.delete(c);
      } else if (canvasKind(c) === "bonus") {
        drawPerfectBonusFrame(c, 0.35);
      }
    }
    rafId = 0;
    return;
  }

  for (const c of registered) {
    if (!c.isConnected) {
      detachLayoutObserver(c);
      registered.delete(c);
      continue;
    }
    drawRegisteredFrame(c, now);
  }

  if (registered.size === 0) {
    rafId = 0;
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function ensureLoop() {
  if (rafId || registered.size === 0) return;
  rafId = requestAnimationFrame(tick);
}

/**
 * Registra canvases de fila líder (bonus + tiers) bajo `root`; un solo requestAnimationFrame.
 * @param {ParentNode | null | undefined} root
 */
export function syncQuinielaPerfectBonusCanvases(root) {
  if (!root) return;

  root
    .querySelectorAll("canvas.quiniela-perfect-bonus-gradient-canvas, canvas.quiniela-lead-tier-gradient-canvas")
    .forEach((el) => {
      if (el instanceof HTMLCanvasElement && !el.dataset.pm26LeadGradientReady) {
        el.dataset.pm26LeadGradientReady = "1";
        registered.add(el);
        attachLayoutObserver(el);
      }
    });

  ensureLoop();
}

if (typeof window !== "undefined") {
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  mq?.addEventListener?.("change", () => {
    if (registered.size) ensureLoop();
  });
}
