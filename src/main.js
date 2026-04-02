import { initApp } from "./app.js";
import { initRemoteSync, startRemoteSyncCatchup } from "./sync.js";

void initRemoteSync()
  .then((ok) => {
    if (ok) startRemoteSyncCatchup();
  })
  .finally(() => {
    initApp();
  });
