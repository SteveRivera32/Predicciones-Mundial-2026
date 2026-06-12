import { getMe } from "./api.js";

const APP_URL = "/ArenaMundial/app/";
const LOGIN_URL = "/ArenaMundial/login/";

export async function requireAuthOrRedirect() {
  try {
    const { user } = await getMe();
    return user;
  } catch {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `${LOGIN_URL}?next=${next}`;
    return null;
  }
}

export async function redirectIfAuthenticated() {
  try {
    await getMe();
    const params = new URLSearchParams(location.search);
    location.href = params.get("next") || APP_URL;
    return true;
  } catch {
    return false;
  }
}

export { APP_URL, LOGIN_URL };
