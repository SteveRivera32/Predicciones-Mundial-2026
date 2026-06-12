const DEVICE_ID_KEY = "arena-device-id";

/** @returns {string | null} */
export function getArenaDeviceId() {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
