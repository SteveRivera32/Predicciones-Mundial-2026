/** Evita import cíclico entre stores y sync.js */

let remoteSyncActive = false;

export function setRemoteSyncActive(value) {
  remoteSyncActive = Boolean(value);
}

export function isRemoteSyncActive() {
  return remoteSyncActive;
}
