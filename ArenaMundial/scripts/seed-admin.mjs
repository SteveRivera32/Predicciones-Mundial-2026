/**
 * Crea o actualiza el usuario admin de Arena.
 * Uso: node ArenaMundial/scripts/seed-admin.mjs
 * Env: ARENA_ADMIN_USER, ARENA_ADMIN_PASS (8 caracteres fuertes: Aa1!…)
 */

import { initDb, getDb, findUserByUsername, createUser } from "../server/db.mjs";
import { hashPassword } from "../server/auth.mjs";
import { isStrongAdminPassword, strongAdminPasswordRuleMessage } from "../server/password-rules.mjs";

const username = String(process.env.ARENA_ADMIN_USER ?? "admin").trim().toLowerCase();
/** 8 caracteres: mayúscula, minúscula, número y símbolo. Sobrescribe con ARENA_ADMIN_PASS. */
const password = String(process.env.ARENA_ADMIN_PASS ?? "Mund@26!");
const displayName = String(process.env.ARENA_ADMIN_NAME ?? "Admin").trim() || "Admin";

if (!/^[a-z0-9_]{3,20}$/.test(username)) {
  console.error("Usuario inválido (3–20: letras, números, _)");
  process.exit(1);
}
if (!isStrongAdminPassword(password)) {
  console.error(strongAdminPasswordRuleMessage());
  process.exit(1);
}

initDb();
const db = getDb();
const existing = findUserByUsername(username);
const passwordHash = await hashPassword(password);

if (existing) {
  db.prepare(
    `UPDATE users SET password_hash = ?, display_name = ?, is_admin = 1 WHERE id = ?`,
  ).run(passwordHash, displayName, existing.id);
  console.log(`[arena] Admin actualizado: usuario «${username}», contraseña reseteada.`);
} else {
  createUser({
    username,
    passwordHash,
    displayName,
    isAdmin: true,
  });
  console.log(`[arena] Admin creado: usuario «${username}».`);
}

console.log(`[arena] Entra en /ArenaMundial/login/ con ese usuario y la contraseña de 8 caracteres.`);
