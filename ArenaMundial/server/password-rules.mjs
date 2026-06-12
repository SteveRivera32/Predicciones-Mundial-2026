/** Contraseña fija de exactamente 8 caracteres (regla Arena). */
export const PASSWORD_LEN = 8;

export function isValidArenaPassword(password) {
  return typeof password === "string" && password.length === PASSWORD_LEN;
}

export function passwordRuleMessage() {
  return `La contraseña debe tener exactamente ${PASSWORD_LEN} caracteres.`;
}

/** Admin: mismos 8 caracteres + mayúscula, minúscula, número y símbolo. */
export function isStrongAdminPassword(password) {
  if (!isValidArenaPassword(password)) return false;
  return (
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^a-zA-Z0-9]/.test(password)
  );
}

export function strongAdminPasswordRuleMessage() {
  return `La contraseña de admin debe tener exactamente ${PASSWORD_LEN} caracteres, con al menos una mayúscula, una minúscula, un número y un símbolo.`;
}
