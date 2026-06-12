/**
 * Autenticación JWT en cookie httpOnly para la versión pública.
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.ARENA_JWT_SECRET || "dev-arena-secret-cambiar-en-produccion";
const COOKIE_NAME = "arena_session";
/** Sesión larga: permanece hasta que el usuario pulse «Salir». */
const TOKEN_TTL = process.env.ARENA_TOKEN_TTL || "365d";
const COOKIE_MAX_AGE_MS = Number(process.env.ARENA_COOKIE_MAX_AGE_MS || 365 * 24 * 60 * 60 * 1000);

export { COOKIE_NAME, JWT_SECRET };

export function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      isAdmin: Boolean(user.is_admin),
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email ?? null,
    isAdmin: Boolean(row.is_admin),
    isPrivadas: Boolean(row.is_privadas),
    createdAt: row.created_at,
  };
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "no autenticado" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload?.sub) {
    res.status(401).json({ error: "sesión inválida" });
    return;
  }
  req.userId = Number(payload.sub);
  req.isAdmin = Boolean(payload.isAdmin);
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.isAdmin) {
    res.status(403).json({ error: "requiere admin" });
    return;
  }
  next();
}
