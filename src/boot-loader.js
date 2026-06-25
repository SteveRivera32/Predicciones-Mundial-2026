/** Pantalla de carga inicial compartida (PrediccionesMundial y ArenaMundial). */

/** @param {string} [hint] */
export function setAppBootLoaderHint(hint) {
  const el = document.getElementById("app-boot-loader-hint");
  if (el && hint) el.textContent = hint;
}

export function dismissAppBootLoader() {
  document.body.classList.remove("app-booting");
  const loader = document.getElementById("app-boot-loader");
  if (!(loader instanceof HTMLElement)) return;
  loader.setAttribute("aria-busy", "false");
  loader.classList.add("app-boot-loader--out");
  const remove = () => {
    loader.hidden = true;
    loader.classList.remove("app-boot-loader--out");
  };
  loader.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 450);
}
