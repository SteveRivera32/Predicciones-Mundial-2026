/**
 * Identificador de dispositivo en cookie httpOnly (fuente de verdad en el servidor).
 * Evita que localStorage distinto por www/apex o por borrado permita varios registros.
 */

import crypto from "crypto";

export const DEVICE_COOKIE_NAME = "arena_device";
const COOKIE_MAX_AGE_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export function deviceIdValid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(s ?? ""),
  );
}

function cookieBaseOptions() {
  /** @type {import("express").CookieOptions} */
  const opts = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  };
  const domain = process.env.ARENA_COOKIE_DOMAIN;
  if (domain) opts.domain = domain;
  return opts;
}

/** @param {import("express").Response} res @param {string} id */
export function setDeviceCookie(res, id) {
  res.cookie(DEVICE_COOKIE_NAME, id, cookieBaseOptions());
}

/** @param {import("express").Response} res */
export function clearDeviceCookie(res) {
  res.clearCookie(DEVICE_COOKIE_NAME, cookieBaseOptions());
}

/**
 * Cookie → body/query (migración desde localStorage) → nuevo UUID.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function resolveDeviceId(req, res) {
  const fromCookie = req.cookies?.[DEVICE_COOKIE_NAME];
  if (deviceIdValid(fromCookie)) return fromCookie;

  const fromBody = req.body?.deviceId;
  const fromQuery = req.query?.deviceId;
  const fallback = deviceIdValid(fromBody) ? fromBody : deviceIdValid(fromQuery) ? fromQuery : null;
  if (fallback) {
    setDeviceCookie(res, fallback);
    return fallback;
  }

  const id = crypto.randomUUID();
  setDeviceCookie(res, id);
  return id;
}
