/**
 * Evita que Safari en iOS ofrezca Face ID / contraseñas guardadas en campos
 * que no son de inicio de sesión (búsqueda de jugadores, PIN local, etc.).
 */

const SEARCH_SELECTOR = ".participant-search-input, #arena-admin-user-search";

/** @param {HTMLInputElement} input */
export function decorateArenaNonLoginInput(input) {
  if (!(input instanceof HTMLInputElement)) return;
  if (input.dataset.arenaAutofillGuard) return;
  input.dataset.arenaAutofillGuard = "1";

  input.autocomplete = "off";
  input.name = "pm26-participant-filter";
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("data-1p-ignore", "true");
  input.setAttribute("data-lpignore", "true");

  input.setAttribute("readonly", "readonly");
  input.addEventListener("focus", () => {
    input.removeAttribute("readonly");
  });
  input.addEventListener("blur", () => {
    input.setAttribute("readonly", "readonly");
  });
}

/** @param {HTMLInputElement} input */
function neuterLocalPinInput(input) {
  if (!(input instanceof HTMLInputElement)) return;
  input.type = "text";
  input.autocomplete = "off";
  input.classList.add("input--masked-pin");
}

/** Quita señales de formulario de login que Safari detecta aunque estén ocultos. */
export function applyArenaIosAutofillGuard() {
  if (typeof document === "undefined") return;

  neuterLocalPinInput(document.getElementById("onboarding-pin"));
  neuterLocalPinInput(document.getElementById("admin-add-pin"));

  const onboardingPin = document.getElementById("onboarding-pin");
  if (onboardingPin instanceof HTMLInputElement) {
    onboardingPin.tabIndex = -1;
    onboardingPin.setAttribute("aria-hidden", "true");
  }

  document.getElementById("form-admin-add-participant")?.setAttribute("autocomplete", "off");

  const adminName = document.getElementById("admin-add-name");
  if (adminName instanceof HTMLInputElement) adminName.autocomplete = "off";

  document.querySelectorAll(SEARCH_SELECTOR).forEach((el) => {
    if (el instanceof HTMLInputElement) decorateArenaNonLoginInput(el);
  });
}
