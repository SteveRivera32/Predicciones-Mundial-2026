/**
 * Pastillas +N (verde / bono arcoíris): fondo en canvas con chroma-js y fase HSL 0→1 = bucle perfecto.
 * Misma idea que quinielaPerfectBonusCanvas.js.
 * @see https://github.com/gka/chroma.js
 */
import chroma from "chroma-js";

const PERIOD_MS = 4500;
const STOPS = 6;

/** @type {Set<HTMLCanvasElement>} */
const registered = new Set();
/** @type {WeakMap<HTMLCanvasElement, ResizeObserver>} */
const resizeObservers = new WeakMap();
let rafId = 0;
let mutationDebounce = 0;

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

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cw
 * @param {number} ch
 * @param {number} phase01
 * @param {"green"|"bonus"} variant
 */
function fillBadgeGradient(ctx, cw, ch, phase01, variant) {
  const { x0, y0, x1, y1 } = cssAngle120GradientEndpoints(cw, ch);
  const grd = ctx.createLinearGradient(x0, y0, x1, y1);

  if (variant === "bonus") {
    const hueShift = phase01 * 360;
    for (let i = 0; i <= STOPS; i++) {
      const p = i / STOPS;
      const hDeg = (p * 360 + hueShift) % 360;
      grd.addColorStop(p, chroma.hsl(hDeg, 0.88, 0.56).css());
    }
  } else {
    for (let i = 0; i <= STOPS; i++) {
      const p = i / STOPS;
      const ang = 2 * Math.PI * phase01 + p * 2 * Math.PI;
      const h = 118 + 26 * Math.sin(ang);
      const s = 0.56 + 0.12 * Math.sin(ang + 0.5);
      const l = 0.34 + 0.1 * Math.sin(ang + 1.2);
      grd.addColorStop(p, chroma.hsl(h, s, l).css());
    }
  }

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, cw, ch);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} phase01
 */
function drawBadgeFrame(canvas, phase01) {
  const host = canvas.closest(".group-preds-pt-badge");
  if (!host) return;

  const variant = canvas.dataset.variant === "bonus" ? "bonus" : "green";
  const dpr = window.devicePixelRatio || 1;
  const br = canvas.getBoundingClientRect();
  const w = Math.max(1, br.width);
  const h = Math.max(1, br.height);
  if (w < 2 || h < 2) return;

  const cw = Math.max(1, Math.round(w * dpr));
  const ch = Math.max(1, Math.round(h * dpr));

  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const ph = prefersReducedMotion() ? 0.35 : phase01;
  fillBadgeGradient(ctx, cw, ch, ph, variant);
}

function detachBadgeObserver(canvas) {
  const ro = resizeObservers.get(canvas);
  if (ro) {
    ro.disconnect();
    resizeObservers.delete(canvas);
  }
}

function attachBadgeObserver(canvas) {
  const host = canvas.closest(".group-preds-pt-badge");
  if (!host || resizeObservers.has(canvas)) return;
  const ro = new ResizeObserver(() => {});
  ro.observe(host);
  resizeObservers.set(canvas, ro);
}

/**
 * Pastillas del HTML estático (Reglas, etc.): solo texto → canvas + etiqueta.
 * @param {ParentNode} root
 */
export function hydrateGroupPtsBadges(root) {
  root.querySelectorAll(".group-preds-pt-badge").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.querySelector(".group-preds-pt-badge__canvas")) return;

    const title = el.getAttribute("title");
    const bonus = el.classList.contains("group-preds-pt-badge--bonus");
    const txt = el.textContent.trim();

    el.replaceChildren();
    const cv = document.createElement("canvas");
    cv.className = "group-preds-pt-badge__canvas";
    cv.dataset.variant = bonus ? "bonus" : "green";
    cv.setAttribute("aria-hidden", "true");

    const sp = document.createElement("span");
    sp.className = "group-preds-pt-badge__txt";
    sp.textContent = txt;

    el.append(cv, sp);
    if (title) el.setAttribute("title", title);
  });
}

function tick(now) {
  if (prefersReducedMotion()) {
    for (const c of [...registered]) {
      if (!c.isConnected) {
        detachBadgeObserver(c);
        registered.delete(c);
      } else drawBadgeFrame(c, 0.35);
    }
    rafId = 0;
    return;
  }

  const phase = (now / PERIOD_MS) % 1;
  for (const c of registered) {
    if (!c.isConnected) {
      detachBadgeObserver(c);
      registered.delete(c);
      continue;
    }
    drawBadgeFrame(c, phase);
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
 * @param {ParentNode | null | undefined} root
 */
export function syncGroupPtsBadgeCanvases(root) {
  if (!root) return;
  hydrateGroupPtsBadges(root);

  root.querySelectorAll("canvas.group-preds-pt-badge__canvas").forEach((el) => {
    if (!(el instanceof HTMLCanvasElement) || el.dataset.pm26BadgeCanvasReady) return;
    el.dataset.pm26BadgeCanvasReady = "1";
    registered.add(el);
    attachBadgeObserver(el);
  });

  ensureLoop();
}

function mutationNeedsBadgeSync(records) {
  for (const r of records) {
    for (const n of r.addedNodes) {
      if (n.nodeType !== 1) continue;
      const el = /** @type {Element} */ (n);
      if (el.matches?.(".group-preds-pt-badge") || el.querySelector?.(".group-preds-pt-badge")) return true;
    }
  }
  return false;
}

/** Observa el DOM para pastillas nuevas tras innerHTML parciales. */
export function initGroupPtsBadgeCanvasObserver() {
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
  const obs = new MutationObserver((records) => {
    if (!mutationNeedsBadgeSync(records)) return;
    window.clearTimeout(mutationDebounce);
    mutationDebounce = window.setTimeout(() => {
      mutationDebounce = 0;
      syncGroupPtsBadgeCanvases(document.body);
    }, 100);
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

if (typeof window !== "undefined") {
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change", () => {
    if (registered.size) ensureLoop();
  });
}
