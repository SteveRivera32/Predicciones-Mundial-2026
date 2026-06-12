/**
 * Prueba rápida: mismo cookie de dispositivo → segundo registro debe fallar con 409.
 * Uso: node ArenaMundial/scripts/test-device-binding.mjs
 */

const BASE = process.env.ARENA_TEST_URL || "http://127.0.0.1:8788/api/arena";
let cookieJar = "";

function storeCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const part = line.split(";")[0];
    const name = part.split("=")[0];
    if (!name) continue;
    const rest = cookieJar
      .split("; ")
      .filter((c) => c && !c.startsWith(`${name}=`));
    rest.push(part);
    cookieJar = rest.join("; ");
  }
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers ?? {}) };
  if (cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  storeCookies(res);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

const suffix = Date.now().toString(36).slice(-5);
const u1 = `testa_${suffix}`;
const u2 = `testb_${suffix}`;
const pass = "12345678";

const bind = await api("/auth/device-binding");
console.log("device-binding:", bind.res.status, bind.data, "cookies:", cookieJar.includes("arena_device="));

const reg1 = await api("/auth/register", {
  method: "POST",
  body: JSON.stringify({ username: u1, password: pass, displayName: u1 }),
});
console.log("register 1:", reg1.res.status, reg1.data.ok ? "ok" : reg1.data.error);

const reg2 = await api("/auth/register", {
  method: "POST",
  body: JSON.stringify({ username: u2, password: pass, displayName: u2 }),
});
console.log("register 2:", reg2.res.status, reg2.data.error || "ok");

if (reg1.res.status === 201 && reg2.res.status === 409) {
  console.log("PASS: segundo registro bloqueado");
  process.exit(0);
}
console.log("FAIL: esperaba 201 y luego 409");
process.exit(1);
